import type { AssetId, BlockId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import {
	type AssetFileType,
	type BucketName,
	type PipelineStatus,
	PROCESS_ASSET_JOB_NAME,
	type ProcessAssetPayload,
	VECTORIZE_ASSET_JOB_NAME,
	type VectorizeAssetPayload,
} from "@orcai/schema";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { sendJobBatchInTransaction } from "./helpers";

const nextIndexAttempt = sql<number>`nextval('block_asset_index_attempt_seq')`;

/** A repository link as the caller saw it: its indexing attempt then. */
export type ObservedLink = {
	readonly assetId: AssetId;
	readonly blockId: BlockId;
	readonly attempt: number;
};

/**
 * Starts a new indexing attempt on each link whose attempt is still the one
 * observed, and queues its job in the same transaction. A link another
 * admission got to first is left to it, so overlapping callers admit it once,
 * and a delivery of an earlier attempt changes nothing. Returns the links
 * admitted.
 */
export const queueIndexing = (observed: readonly ObservedLink[]) =>
	Effect.gen(function* () {
		if (observed.length === 0) return [];
		const db = yield* DB;
		const { blockAsset } = dbSchema;

		return yield* db.transaction(() =>
			Effect.gen(function* () {
				const admitted = yield* db
					.update(blockAsset)
					.set({
						indexStatus: "pending",
						indexFailure: null,
						indexAttempt: nextIndexAttempt,
					})
					.where(
						or(
							...observed.map((link) =>
								and(
									eq(blockAsset.assetId, link.assetId),
									eq(blockAsset.blockId, link.blockId),
									eq(blockAsset.indexAttempt, link.attempt),
								),
							),
						),
					)
					.returning({
						assetId: blockAsset.assetId,
						blockId: blockAsset.blockId,
						attempt: blockAsset.indexAttempt,
					});
				if (admitted.length > 0) {
					yield* sendJobBatchInTransaction<VectorizeAssetPayload>({
						jobName: VECTORIZE_ASSET_JOB_NAME,
						jobs: admitted.map((data) => ({
							data,
						})),
					});
				}
				return admitted;
			}),
		);
	});

/**
 * Starts the asset's next processing generation when its processing is in
 * `from` and its generation is still the one observed, and queues the job in
 * the same transaction. Every repository link
 * turns pending with a new indexing attempt, so no repository claims ready
 * for vectors about to be replaced; processing queues their indexing once it
 * completes. Returns the generation, or undefined when nothing was admitted.
 */
export const queueProcessing = (
	asset: {
		id: AssetId;
		bucket: BucketName;
		prefix: string;
		fileType: AssetFileType;
		processingGeneration: number;
	},
	from: readonly PipelineStatus[],
) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const { asset: assetTable, blockAsset } = dbSchema;

		return yield* db.transaction(() =>
			Effect.gen(function* () {
				const [admitted] = yield* db
					.update(assetTable)
					.set({
						processingStatus: "pending",
						processingFailure: null,
						processingGeneration: sql`${assetTable.processingGeneration} + 1`,
					})
					.where(
						and(
							eq(assetTable.id, asset.id),
							eq(assetTable.processingGeneration, asset.processingGeneration),
							inArray(assetTable.processingStatus, [
								...from,
							]),
						),
					)
					.returning({
						generation: assetTable.processingGeneration,
					});
				if (!admitted) return undefined;

				yield* db
					.update(blockAsset)
					.set({
						indexStatus: "pending",
						indexFailure: null,
						indexAttempt: nextIndexAttempt,
					})
					.where(eq(blockAsset.assetId, asset.id));
				yield* sendJobBatchInTransaction<ProcessAssetPayload>({
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
								generation: admitted.generation,
							},
						},
					],
				});
				return admitted.generation;
			}),
		);
	});
