import { buckets } from "@orcai/core";
import { DB, dbSchema, retryDeadlocks } from "@orcai/db";
import type { Job } from "@orcai/pg-boss";
import { queueAfterProcessing, toPgBossRunError } from "@orcai/pg-boss";
import {
	buildStoredExtractionImageKey,
	buildStoredExtractionKey,
	createImageOnlyStoredExtractionArtifact,
	createStoredExtractionArtifact,
	extract,
	type StoredExtractionArtifact,
	serializeStoredExtractionArtifact,
} from "@orcai/process";
import { getMimeTypeFromFileType } from "@orcai/s3";
import {
	deletePrefixRecursively,
	sendPutObjectCommand,
} from "@orcai/s3/server";
import {
	isImageFileType,
	PROCESS_ASSET_JOB_NAME,
	type ProcessAssetPayload,
} from "@orcai/schema";
import * as Effect from "effect/Effect";
import { describeImages, imageMediaType } from "@/asset/image-descriptions";
import {
	AssetPipelineError,
	claimProcessing,
	currentProcessing,
	type ProcessingAttempt,
	processingAttempt,
	settleProcessingAttempt,
} from "@/asset/pipeline-attempt";
import { validateImageResolution } from "@/asset/utils/validate-image-resolution";

const getAssetObjectKey = (assetRef: ProcessAssetPayload["assetRef"]) =>
	`${assetRef.prefix}/${assetRef.id}.${assetRef.type}`;

const getRequiredMimeType = (params: {
	fileType: ProcessAssetPayload["assetRef"]["type"];
	jobId: string;
}) =>
	Effect.fromNullishOr(getMimeTypeFromFileType(params.fileType)).pipe(
		Effect.mapError(
			() =>
				new AssetPipelineError({
					failure: "unsupported",
					cause: toPgBossRunError(
						params.jobId,
						PROCESS_ASSET_JOB_NAME,
					)(new Error(`Unsupported asset file type: ${params.fileType}`)),
				}),
		),
	);

export const processAssetBatch = (jobs: Job<ProcessAssetPayload>[]) =>
	Effect.forEach(
		jobs,
		(job) =>
			processAssets({
				job,
			}),
		{
			discard: true,
		},
	);

const createDocumentArtifact = (params: {
	result: Parameters<typeof createStoredExtractionArtifact>[0]["result"];
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
						const validationResult = validateImageResolution({
							width,
							height,
						});

						if (!validationResult.isValid) {
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
					}).pipe(
						Effect.mapError(
							toPgBossRunError(params.jobId, PROCESS_ASSET_JOB_NAME),
						),
						Effect.tapError((err) =>
							Effect.logError(
								{
									err,
									jobId: params.jobId,
									assetId: params.assetId,
									imageIndex: image.imageIndex,
								},
								"Error uploading extracted image",
							),
						),
					);

					storedImagePaths.set(image.imageIndex, key);
				}),
			{
				concurrency: 4,
				discard: true,
			},
		);

		return createStoredExtractionArtifact({
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

const isEmptyArtifact = (artifact: StoredExtractionArtifact) =>
	artifact.content.trim().length === 0 &&
	artifact.chunks.length === 0 &&
	artifact.images.length === 0;

/**
 * Completes the attempt and queues indexing in every repository the asset is
 * linked to, in one transaction: a retry after a crash finds the attempt
 * still active and gets here again. An attach reads the asset's status with a
 * share lock, so a link it adds meanwhile is queued either here or by the
 * attach. A replaced attempt completes nothing and queues nothing.
 */
const completeAndQueueIndexing = (attempt: ProcessingAttempt) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const { asset } = dbSchema;

		return yield* retryDeadlocks(
			db.transaction(() =>
				Effect.gen(function* () {
					const completed = yield* db
						.update(asset)
						.set({
							processingStatus: "completed",
							processingFailure: null,
						})
						.where(currentProcessing(attempt))
						.returning({
							id: asset.id,
						});
					if (completed.length === 0) return false;
					yield* queueAfterProcessing(attempt);
					return true;
				}),
			),
		);
	});

const processAssets = (params: { job: Job<ProcessAssetPayload> }) =>
	Effect.gen(function* () {
		const attempt = processingAttempt(params.job.data);
		if (!(yield* claimProcessing(attempt))) {
			return yield* Effect.logInfo(
				{
					jobId: params.job.id,
					assetId: attempt.assetId,
				},
				"Skipping a processing delivery that is done or replaced",
			);
		}
		yield* processDelivery({
			job: params.job,
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
			prefix: `${assetRef.id}/`,
		});

		const mimeType = yield* getRequiredMimeType({
			fileType: assetRef.type,
			jobId: params.job.id,
		});
		const objectKey = getAssetObjectKey(assetRef);
		const imageAsset = isImageFileType(assetRef.type);
		const extracted = imageAsset
			? createImageOnlyStoredExtractionArtifact({
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
								cause: toPgBossRunError(
									params.job.id,
									PROCESS_ASSET_JOB_NAME,
								)(cause),
							}),
					),
					Effect.tapError((err) =>
						Effect.logError(
							{
								err,
								jobId: params.job.id,
								assetId: assetRef.id,
								fileType: assetRef.type,
								mimeType,
							},
							"Error extracting asset with Kreuzberg",
						),
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

		yield* sendPutObjectCommand({
			bucket: buckets.processed.name,
			key: buildStoredExtractionKey(assetRef.id),
			body: Buffer.from(serializeStoredExtractionArtifact(artifact), "utf-8"),
			contentType: "application/json",
		}).pipe(
			Effect.mapError(toPgBossRunError(params.job.id, PROCESS_ASSET_JOB_NAME)),
			Effect.tapError((err) =>
				Effect.logError(
					{
						err,
						jobId: params.job.id,
						assetId: assetRef.id,
					},
					"Error uploading extraction artifact",
				),
			),
		);

		if (!(yield* completeAndQueueIndexing(params.attempt))) {
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
	}).pipe(
		Effect.tapError((err) =>
			Effect.logError(
				{
					err,
				},
				"Process asset job failed",
			),
		),
		(run) => settleProcessingAttempt(params.attempt, run),
	);
