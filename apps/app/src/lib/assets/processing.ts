import type { AssetId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { queueProcessing, sendJobBatch } from "@orcai/pg-boss";
import {
	type AssetFileType,
	type BucketName,
	PROCESS_ASSET_JOB_NAME,
} from "@orcai/schema";
import { and, eq } from "drizzle-orm";
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
 * failed, so Retry shows, unless another generation was started meanwhile.
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
					.where(
						and(
							eq(dbSchema.asset.id, asset.id),
							eq(
								dbSchema.asset.processingGeneration,
								asset.processingGeneration,
							),
							eq(dbSchema.asset.processingStatus, "pending"),
						),
					),
			),
		);
	});

/**
 * Processes a completed or failed asset again, as its next processing
 * generation. Returns false, and queues nothing, when the asset is already
 * pending or being processed, or another request started a generation since
 * the caller read it.
 */
export const reprocessAsset = (asset: ProcessableAsset) =>
	queueProcessing(asset, [
		"completed",
		"failed",
	]).pipe(Effect.map((generation) => generation !== undefined));
