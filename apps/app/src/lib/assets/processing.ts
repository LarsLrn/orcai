import type { ActivityRunId, AssetId, BlockId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { logErrorCause } from "@orcai/observability";
import {
	newFailureId,
	queueProcessing,
	sendJobBatchInTransaction,
	settleStage,
} from "@orcai/pg-boss";
import {
	type AssetFileType,
	type BucketName,
	PROCESS_ASSET_JOB_NAME,
	type ProcessAssetPayload,
} from "@orcai/schema";
import { eq } from "drizzle-orm";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";

type ProcessableAsset = {
	id: AssetId;
	bucket: BucketName;
	prefix: string;
	fileType: AssetFileType;
	processingGeneration: number;
};

/**
 * Queues a new asset's first processing as the run's work, in the
 * transaction that inserts it, so the asset never commits without its job.
 * A queue that refuses the job marks the asset failed instead, so Retry
 * shows. Returns the asset as it stands.
 */
export const queueFirstProcessing = (
	asset: typeof dbSchema.asset.$inferSelect,
	runId?: ActivityRunId,
) =>
	sendJobBatchInTransaction<ProcessAssetPayload>({
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
					runId,
				},
			},
		],
	}).pipe(
		Effect.as(asset),
		Effect.catch((error) =>
			Effect.gen(function* () {
				yield* logErrorCause(
					"Asset processing not enqueued",
					Cause.fail(error),
				);
				const db = yield* DB;
				const [failed] = yield* db
					.update(dbSchema.asset)
					.set({
						processingStatus: "failed",
						processingFailure: "other",
						processingFailureId: newFailureId,
					})
					.where(eq(dbSchema.asset.id, asset.id))
					.returning();
				yield* settleStage(
					runId,
					{
						stage: "processing",
						assetId: asset.id,
					},
					{
						state: "failed",
						failureId: failed.processingFailureId,
					},
				);
				return failed;
			}),
		),
	);

/**
 * Processes a completed or failed asset again, as its next processing
 * generation and the run's work. Returns false, and queues nothing, when the
 * asset is already pending or being processed, or another request started a
 * generation since the caller read it.
 */
export const reprocessAsset = (
	asset: ProcessableAsset,
	run?: {
		id: ActivityRunId;
		blockId?: BlockId;
	},
) =>
	queueProcessing(
		asset,
		[
			"completed",
			"failed",
		],
		run,
	).pipe(Effect.map((generation) => generation !== undefined));
