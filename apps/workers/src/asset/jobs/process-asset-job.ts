import { type AssetId, buckets } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import type { Job } from "@orcai/pg-boss";
import { sendJobBatch, toPgBossRunError } from "@orcai/pg-boss";
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
	VECTORIZE_ASSET_JOB_NAME,
} from "@orcai/schema";
import { and, eq } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { describeImages, imageMediaType } from "@/asset/image-descriptions";
import {
	AssetPipelineError,
	settleProcessingAttempt,
} from "@/asset/pipeline-failure";
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
 * Queues indexing in every repository the asset is linked to. The links turn
 * pending before the asset turns completed, and are read after it, so a link
 * added meanwhile is queued either here or by the attach.
 */
const completeAndQueueIndexing = (params: {
	assetId: AssetId;
	jobId: string;
}) =>
	Effect.gen(function* () {
		const db = yield* DB;

		yield* db
			.update(dbSchema.blockAsset)
			.set({
				indexStatus: "pending",
				indexFailure: null,
			})
			.where(eq(dbSchema.blockAsset.assetId, params.assetId));
		yield* db
			.update(dbSchema.asset)
			.set({
				processingStatus: "completed",
				processingFailure: null,
			})
			.where(eq(dbSchema.asset.id, params.assetId));

		const attachedBlocks = yield* db
			.select({
				blockId: dbSchema.blockAsset.blockId,
			})
			.from(dbSchema.blockAsset)
			.where(eq(dbSchema.blockAsset.assetId, params.assetId));

		yield* Effect.forEach(
			attachedBlocks,
			({ blockId }) =>
				sendJobBatch({
					jobName: VECTORIZE_ASSET_JOB_NAME,
					jobs: [
						{
							data: {
								assetId: params.assetId,
								blockId,
							},
						},
					],
				}).pipe(
					Effect.tapError((err) =>
						Effect.logError(
							{
								err,
								jobId: params.jobId,
								assetId: params.assetId,
								blockId,
							},
							"Failed to dispatch follow-up vectorization job",
						),
					),
					Effect.catch(() =>
						db
							.update(dbSchema.blockAsset)
							.set({
								indexStatus: "failed",
								indexFailure: "other",
							})
							.where(
								and(
									eq(dbSchema.blockAsset.assetId, params.assetId),
									eq(dbSchema.blockAsset.blockId, blockId),
								),
							),
					),
				),
			{
				concurrency: "unbounded",
				discard: true,
			},
		);
	});

const processAssets = (params: { job: Job<ProcessAssetPayload> }) =>
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

		yield* completeAndQueueIndexing({
			assetId: assetRef.id,
			jobId: params.job.id,
		});

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
		(attempt) => settleProcessingAttempt(params.job.data.assetRef.id, attempt),
	);
