import { buckets } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import type { Job } from "@orcai/pg-boss";
import { sendJobBatch, toPgBossRunError } from "@orcai/pg-boss";
import {
	buildStoredExtractionImageKey,
	buildStoredExtractionKey,
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

		const result = yield* extract(
			{
				kind: "s3",
				bucket: assetRef.bucket,
				key: getAssetObjectKey(assetRef),
				mimeType: getMimeTypeFromFileType(assetRef.type),
				filename: `${assetRef.id}.${assetRef.type}`,
			},
			{
				profile: "asset-heavy",
			},
		).pipe(
			Effect.mapError(toPgBossRunError(params.job.id, PROCESS_ASSET_JOB_NAME)),
			Effect.tapError((err) =>
				Effect.logError(
					{
						err,
						jobId: params.job.id,
						assetId: assetRef.id,
						fileType: assetRef.type,
						mimeType: getMimeTypeFromFileType(assetRef.type),
					},
					"Error extracting asset with Kreuzberg",
				),
			),
		);

		const storedImagePaths = new Map<number, string>();

		yield* Effect.forEach(
			result.images ?? [],
			(image) =>
				Effect.gen(function* () {
					const validationResult = validateImageResolution(
						{
							width: image.width ?? undefined,
							height: image.height ?? undefined,
						},
						2,
					);

					if (!validationResult.isValid) {
						return yield* Effect.logWarning(
							{
								jobId: params.job.id,
								assetId: assetRef.id,
								imageIndex: image.imageIndex,
								width: image.width,
								height: image.height,
							},
							"Skipping extracted image due to resolution/validation",
						);
					}

					const key = buildStoredExtractionImageKey({
						assetId: assetRef.id,
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
							toPgBossRunError(params.job.id, PROCESS_ASSET_JOB_NAME),
						),
						Effect.tapError((err) =>
							Effect.logError(
								{
									err,
									jobId: params.job.id,
									assetId: assetRef.id,
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

		const artifact = createStoredExtractionArtifact({
			result,
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
			"Completed asset processing with Kreuzberg",
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
