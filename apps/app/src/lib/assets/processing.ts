import type { AssetId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { sendJobBatch } from "@orcai/pg-boss";
import {
	type AssetFileType,
	type BucketName,
	PROCESS_ASSET_JOB_NAME,
} from "@orcai/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import * as Effect from "effect/Effect";

type ProcessableAsset = {
	id: AssetId;
	bucket: BucketName;
	prefix: string;
	fileType: AssetFileType;
	processingGeneration: number;
};

/**
 * Queues processing of a pending asset. A failed enqueue marks the asset
 * failed, so Retry shows.
 */
export const enqueueAssetProcessing = (asset: ProcessableAsset) =>
	Effect.gen(function* () {
		const db = yield* DB;

		yield* sendJobBatch({
			jobName: PROCESS_ASSET_JOB_NAME,
			jobs: [
				{
					data: {
						assetRef: {
							bucket: asset.bucket,
							prefix: asset.prefix,
							id: asset.id,
							type: asset.fileType,
						},
						generation: asset.processingGeneration,
					},
				},
			],
		}).pipe(
			Effect.tapError(() =>
				db
					.update(dbSchema.asset)
					.set({
						processingStatus: "failed",
						processingFailure: "other",
					})
					.where(eq(dbSchema.asset.id, asset.id)),
			),
		);
	});

/**
 * Processes a completed or failed asset again, as its next processing
 * generation. The asset and every repository link turn pending in one
 * transaction, so no repository claims ready for vectors about to be
 * replaced. Returns false, and queues nothing, when the asset is already
 * pending or being processed.
 */
export const reprocessAsset = (
	asset: Omit<ProcessableAsset, "processingGeneration">,
) =>
	Effect.gen(function* () {
		const db = yield* DB;

		const generation = yield* db.transaction(() =>
			Effect.gen(function* () {
				const reset = yield* db
					.update(dbSchema.asset)
					.set({
						processingStatus: "pending",
						processingFailure: null,
						processingGeneration: sql`${dbSchema.asset.processingGeneration} + 1`,
					})
					.where(
						and(
							eq(dbSchema.asset.id, asset.id),
							inArray(dbSchema.asset.processingStatus, [
								"completed",
								"failed",
							]),
						),
					)
					.returning({
						processingGeneration: dbSchema.asset.processingGeneration,
					});
				const [admitted] = reset;
				if (!admitted) return undefined;

				yield* db
					.update(dbSchema.blockAsset)
					.set({
						indexStatus: "pending",
						indexFailure: null,
					})
					.where(eq(dbSchema.blockAsset.assetId, asset.id));
				return admitted.processingGeneration;
			}),
		);

		if (generation === undefined) return false;
		yield* enqueueAssetProcessing({
			...asset,
			processingGeneration: generation,
		});
		return true;
	});
