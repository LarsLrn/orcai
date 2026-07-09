import { buckets } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import type { Job } from "@orcai/pg-boss";
import { sendJobBatch, toPgBossRunError } from "@orcai/pg-boss";
import {
	buildStoredExtractionImageKey,
	buildStoredExtractionKey,
	createImageOnlyStoredExtractionArtifact,
	createStoredExtractionArtifact,
	extract,
	serializeStoredExtractionArtifact,
} from "@orcai/process";
import { getMimeTypeFromFileType } from "@orcai/s3";
import {
	deletePrefixRecursively,
	sendPutObjectCommand,
} from "@orcai/s3/server";
import {
	PROCESS_ASSET_JOB_NAME,
	type ProcessAssetPayload,
	VECTORIZE_ASSET_JOB_NAME,
} from "@orcai/schema";
import { eq } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { validateImageResolution } from "@/asset/utils/validate-image-resolution";

const getAssetObjectKey = (assetRef: ProcessAssetPayload["assetRef"]) =>
	`${assetRef.prefix}/${assetRef.id}.${assetRef.type}`;

const getImageContentType = (format: string) => {
	const normalizedFormat = format.toLowerCase();

	if (normalizedFormat === "jpg" || normalizedFormat === "jpeg") {
		return "image/jpeg";
	}

	if (normalizedFormat === "png") {
		return "image/png";
	}

	if (normalizedFormat === "gif") {
		return "image/gif";
	}

	if (normalizedFormat === "webp") {
		return "image/webp";
	}

	return `image/${normalizedFormat}`;
};

const IMAGE_FILE_TYPES = new Set([
	"jpeg",
	"jpg",
	"png",
	"gif",
	"webp",
]);

const isImageFileType = (fileType: string) => IMAGE_FILE_TYPES.has(fileType);

const getRequiredMimeType = (params: {
	fileType: ProcessAssetPayload["assetRef"]["type"];
	jobId: string;
}) =>
	Effect.fromNullishOr(getMimeTypeFromFileType(params.fileType)).pipe(
		Effect.mapError(() =>
			toPgBossRunError(
				params.jobId,
				PROCESS_ASSET_JOB_NAME,
			)(new Error(`Unsupported asset file type: ${params.fileType}`)),
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
						contentType: getImageContentType(image.format),
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

const processAssets = (params: { job: Job<ProcessAssetPayload> }) =>
	Effect.gen(function* () {
		const { assetRef } = params.job.data;
		const db = yield* DB;

		yield* db
			.update(dbSchema.asset)
			.set({
				processingStatus: "active",
			})
			.where(eq(dbSchema.asset.id, assetRef.id));

		yield* deletePrefixRecursively({
			bucket: buckets.processed.name,
			prefix: `${assetRef.id}/`,
		});

		const mimeType = yield* getRequiredMimeType({
			fileType: assetRef.type,
			jobId: params.job.id,
		});
		const objectKey = getAssetObjectKey(assetRef);
		const artifact = isImageFileType(assetRef.type)
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
						toPgBossRunError(params.job.id, PROCESS_ASSET_JOB_NAME),
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

		yield* db
			.update(dbSchema.asset)
			.set({
				processingStatus: "completed",
			})
			.where(eq(dbSchema.asset.id, assetRef.id));

		const attachedBlocks = yield* db
			.select({
				blockId: dbSchema.blockAsset.blockId,
			})
			.from(dbSchema.blockAsset)
			.where(eq(dbSchema.blockAsset.assetId, assetRef.id));

		if (attachedBlocks.length > 0) {
			yield* Effect.forEach(
				attachedBlocks,
				({ blockId }) =>
					sendJobBatch({
						jobName: VECTORIZE_ASSET_JOB_NAME,
						jobs: [
							{
								data: {
									assetId: assetRef.id,
									blockId,
								},
							},
						],
						resourceOptions: {
							resourceId: blockId,
							resourceType: "block",
						},
					}),
				{
					concurrency: "unbounded",
					discard: true,
				},
			).pipe(
				Effect.tapError((err) =>
					Effect.logError(
						{
							err,
							jobId: params.job.id,
							assetId: assetRef.id,
						},
						"Failed to dispatch follow-up vectorization jobs",
					),
				),
				Effect.catch(() => Effect.void),
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
			Effect.gen(function* () {
				yield* Effect.logError(
					{
						err,
					},
					"Process asset job failed",
				);
				const db = yield* DB;
				yield* db
					.update(dbSchema.asset)
					.set({
						processingStatus: "failed",
					})
					.where(eq(dbSchema.asset.id, params.job.data.assetRef.id));
			}),
		),
	);
