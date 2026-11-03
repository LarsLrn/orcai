import { buckets } from "@orcai/core";
import type { Job } from "@orcai/pg-boss";
import {
	AssetPipelineError,
	claimProcessing,
	completeProcessing,
	type ProcessingAttempt,
	processingAttempt,
	settleProcessingAttempt,
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

const createDocumentArtifact = (params: {
	result: Parameters<typeof createExtractionArtifact>[0]["result"];
	jobId: string;
	assetId: string;
}) =>
	Effect.gen(function* () {
		const storedImagePaths = new Map<number, string>();

		yield* Effect.forEach(
			params.result.images ?? [],
			(image) =>
				Effect.gen(function* () {
					const width =
						typeof image.width === "number" ? image.width : undefined;
					const height =
						typeof image.height === "number" ? image.height : undefined;
					const hasDimensions = width !== undefined && height !== undefined;

					if (hasDimensions) {
						if (width <= 200 || height <= 200) {
							return yield* Effect.logWarning(
								{
									jobId: params.jobId,
									assetId: params.assetId,
									imageIndex: image.imageIndex,
									width,
									height,
								},
								"Skipping extracted image due to resolution/validation",
							);
						}
					}

					const key = buildStoredExtractionImageKey({
						assetId: params.assetId,
						imageIndex: image.imageIndex,
						format: image.format,
					});

					yield* sendPutObjectCommand({
						bucket: buckets.processed.name,
						key,
						body: Buffer.from(image.data),
						contentType: imageMediaType(image.format),
					});

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
							assetId: assetRef.id,
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

		yield* writeStoredExtraction(assetRef.id, artifact);

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
