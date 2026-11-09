import { createHash } from "node:crypto";
import { buckets } from "@orcai/core";
import type { Job } from "@orcai/pg-boss";
import {
	AssetPipelineError,
	claimProcessing,
	completeProcessing,
	type ProcessingAttempt,
	processingAttempt,
	settleProcessingAttempt,
	writeWhileProcessing,
} from "@orcai/preparation";
import {
	buildStoredExtractionImageKey,
	createExtractionArtifact,
	createImageOnlyExtractionArtifact,
	type ExtractionArtifact,
	extract,
	writeStoredExtraction,
} from "@orcai/process";
import {
	assetObjectKey,
	getMimeTypeFromFileType,
	processedAssetPrefix,
} from "@orcai/s3";
import {
	deletePrefixRecursively,
	sendPutObjectCommand,
} from "@orcai/s3/server";
import { isImageFileType, type ProcessAssetPayload } from "@orcai/schema";
import * as Effect from "effect/Effect";
import { describeImages, imageMediaType } from "@/asset/image-descriptions";

const getRequiredMimeType = (
	fileType: ProcessAssetPayload["assetRef"]["type"],
) =>
	Effect.fromNullishOr(getMimeTypeFromFileType(fileType)).pipe(
		Effect.mapError(
			() =>
				new AssetPipelineError({
					failure: "unsupported",
					cause: new Error(`Unsupported asset file type: ${fileType}`),
				}),
		),
	);

/** Images below this many pixels are icons and bullets, not figures. */
const MIN_IMAGE_PIXELS = 40_000;

/** Stores each distinct image of the document once, skipping those below `MIN_IMAGE_PIXELS`. */
const createDocumentArtifact = (params: {
	result: Parameters<typeof createExtractionArtifact>[0]["result"];
	jobId: string;
	attempt: ProcessingAttempt;
}) =>
	Effect.gen(function* () {
		const log = {
			jobId: params.jobId,
			assetId: params.attempt.assetId,
		};
		const firstIndexByDigest = new Map<string, number>();
		const kept: NonNullable<typeof params.result.images> = [];
		let repeatCount = 0;

		for (const image of params.result.images ?? []) {
			const width = typeof image.width === "number" ? image.width : undefined;
			const height =
				typeof image.height === "number" ? image.height : undefined;
			if (
				width !== undefined &&
				height !== undefined &&
				width * height < MIN_IMAGE_PIXELS
			) {
				yield* Effect.logWarning(
					{
						...log,
						imageIndex: image.imageIndex,
						width,
						height,
					},
					"Skipping extracted image due to resolution/validation",
				);
				continue;
			}

			const digest = createHash("sha256").update(image.data).digest("hex");
			const firstIndex = firstIndexByDigest.get(digest);
			if (firstIndex !== undefined) {
				repeatCount += 1;
				yield* Effect.logDebug(
					{
						...log,
						imageIndex: image.imageIndex,
						repeatOf: firstIndex,
					},
					"Skipping extracted image that repeats an earlier one",
				);
				continue;
			}
			firstIndexByDigest.set(digest, image.imageIndex);
			kept.push(image);
		}

		if (repeatCount > 0) {
			yield* Effect.logInfo(
				{
					...log,
					repeatCount,
					keptCount: kept.length,
				},
				"Skipped repeated images in the document",
			);
		}

		const storedImagePaths = new Map<number, string>();
		yield* Effect.forEach(
			kept,
			(image) =>
				Effect.gen(function* () {
					const key = buildStoredExtractionImageKey({
						assetId: params.attempt.assetId,
						imageIndex: image.imageIndex,
						format: image.format,
					});

					yield* writeWhileProcessing(
						params.attempt,
						sendPutObjectCommand({
							bucket: buckets.processed.name,
							key,
							body: Buffer.from(image.data),
							contentType: imageMediaType(image.format),
						}),
					);

					storedImagePaths.set(image.imageIndex, key);
				}),
			{
				concurrency: 4,
				discard: true,
			},
		);

		return createExtractionArtifact({
			result: params.result,
			transformImage: (image) => {
				const sourcePath = storedImagePaths.get(image.imageIndex);
				if (!sourcePath) {
					return undefined;
				}

				return {
					...image,
					sourcePath,
				};
			},
		});
	});

const isEmptyArtifact = (artifact: ExtractionArtifact) =>
	artifact.content.trim().length === 0 &&
	artifact.chunks.length === 0 &&
	artifact.images.length === 0;

export const processAsset = (job: Job<ProcessAssetPayload>) =>
	Effect.gen(function* () {
		const attempt = processingAttempt(job.data);
		if (!(yield* claimProcessing(attempt))) {
			return yield* Effect.logInfo(
				{
					jobId: job.id,
					assetId: attempt.assetId,
				},
				"Skipping a processing delivery that is done or replaced",
			);
		}
		yield* processDelivery({
			job,
			attempt,
		});
	});

const processDelivery = (params: {
	job: Job<ProcessAssetPayload>;
	attempt: ProcessingAttempt;
}) =>
	Effect.gen(function* () {
		const { assetRef } = params.job.data;

		yield* deletePrefixRecursively({
			bucket: buckets.processed.name,
			prefix: processedAssetPrefix(assetRef.id),
		});

		const mimeType = yield* getRequiredMimeType(assetRef.type);
		const objectKey = assetObjectKey({
			prefix: assetRef.prefix,
			id: assetRef.id,
			fileType: assetRef.type,
		});
		const imageAsset = isImageFileType(assetRef.type);
		const extracted = imageAsset
			? createImageOnlyExtractionArtifact({
					mimeType,
					format: assetRef.type,
					sourceBucket: assetRef.bucket,
					sourcePath: objectKey,
				})
			: yield* extract(
					{
						kind: "s3",
						bucket: assetRef.bucket,
						key: objectKey,
						mimeType,
						filename: `${assetRef.id}.${assetRef.type}`,
					},
					{
						profile: "asset-heavy",
					},
				).pipe(
					Effect.mapError(
						(cause) =>
							new AssetPipelineError({
								failure: "extraction",
								cause,
							}),
					),
					Effect.flatMap((result) =>
						createDocumentArtifact({
							result,
							jobId: params.job.id,
							attempt: params.attempt,
						}),
					),
				);

		if (isEmptyArtifact(extracted)) {
			return yield* new AssetPipelineError({
				failure: "empty",
				cause: new Error(`Asset ${assetRef.id} has no extractable content`),
			});
		}

		const artifact = yield* describeImages({
			assetId: assetRef.id,
			jobId: params.job.id,
			artifact: extracted,
			imageAsset,
		});

		yield* writeWhileProcessing(
			params.attempt,
			writeStoredExtraction(assetRef.id, artifact),
		);

		if (!(yield* completeProcessing(params.attempt))) {
			return yield* Effect.logInfo(
				{
					jobId: params.job.id,
					assetId: assetRef.id,
				},
				"Not completing a processing attempt that was replaced",
			);
		}

		yield* Effect.logInfo(
			{
				jobId: params.job.id,
				assetId: assetRef.id,
				chunkCount: artifact.chunks.length,
				imageCount: artifact.images.length,
			},
			"Completed asset processing",
		);
	}).pipe((run) => settleProcessingAttempt(params.attempt, run));
