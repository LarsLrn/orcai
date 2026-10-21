import type { AssetId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { sendJobBatch } from "@orcai/pg-boss";
import {
	type AssetFileType,
	type BucketName,
	PROCESS_ASSET_JOB_NAME,
} from "@orcai/schema";
import { eq } from "drizzle-orm";
import * as Effect from "effect/Effect";

/**
 * Queues the asset for processing. The asset and every repository link turn
 * pending first, so no repository claims ready for vectors about to be
 * replaced. A failed enqueue marks the asset failed, so Retry shows.
 */
export const enqueueAssetProcessing = (asset: {
	id: AssetId;
	bucket: BucketName;
	prefix: string;
	fileType: AssetFileType;
}) =>
	Effect.gen(function* () {
		const db = yield* DB;

		yield* db.transaction(() =>
			Effect.gen(function* () {
				yield* db
					.update(dbSchema.asset)
					.set({
						processingStatus: "pending",
						processingFailure: null,
					})
					.where(eq(dbSchema.asset.id, asset.id));
				yield* db
					.update(dbSchema.blockAsset)
					.set({
						indexStatus: "pending",
						indexFailure: null,
					})
					.where(eq(dbSchema.blockAsset.assetId, asset.id));
			}),
		);

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
					},
				},
			],
			resourceOptions: {
				resourceId: asset.id,
				resourceType: "asset",
			},
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
