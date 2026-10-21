import type { AssetId, BlockId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import type { JobWithMetadata } from "@orcai/pg-boss";
import {
	isRetryableFailure,
	type PipelineFailure,
	type ProcessAssetPayload,
	type VectorizeAssetPayload,
} from "@orcai/schema";
import { and, type Column, eq, ne, sql } from "drizzle-orm";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";

/** An attempt failed for a known reason. Any other error counts as `other`. */
export class AssetPipelineError extends Data.TaggedError("AssetPipelineError")<{
	readonly failure: PipelineFailure;
	readonly cause: unknown;
}> {}

type Write = {
	readonly status?: "active" | "failed";
	/** `recorded` keeps the kind an earlier attempt stored, else `other`. */
	readonly failure: PipelineFailure | "recorded" | null;
	/** Leaves a completed target alone. */
	readonly unlessCompleted?: boolean;
};

type Target = (values: Write) => Effect.Effect<void, unknown, DB>;

const failureValue = (failure: Write["failure"], column: Column) =>
	failure === "recorded" ? sql`coalesce(${column}, 'other')` : failure;

const processingTarget =
	(assetId: AssetId): Target =>
	(values) =>
		Effect.gen(function* () {
			const db = yield* DB;
			const { asset } = dbSchema;
			yield* db
				.update(asset)
				.set({
					processingStatus: values.status,
					processingFailure: failureValue(
						values.failure,
						asset.processingFailure,
					),
				})
				.where(
					and(
						eq(asset.id, assetId),
						values.unlessCompleted
							? ne(asset.processingStatus, "completed")
							: undefined,
					),
				);
		});

const indexingTarget =
	(link: { assetId: AssetId; blockId: BlockId }): Target =>
	(values) =>
		Effect.gen(function* () {
			const db = yield* DB;
			const { blockAsset } = dbSchema;
			yield* db
				.update(blockAsset)
				.set({
					indexStatus: values.status,
					indexFailure: failureValue(values.failure, blockAsset.indexFailure),
				})
				.where(
					and(
						eq(blockAsset.assetId, link.assetId),
						eq(blockAsset.blockId, link.blockId),
						values.unlessCompleted
							? ne(blockAsset.indexStatus, "completed")
							: undefined,
					),
				);
		});

/**
 * Runs one attempt and keeps the stored status honest. The attempt starts
 * active. A retryable failure records its kind and fails the job so pg-boss
 * retries it; the dead letter handler marks it failed once retries run out. A
 * failure retrying cannot fix marks it failed at once and completes the job.
 * The attempt writes completed itself.
 */
const settleAttempt = <A, E, R>(
	target: Target,
	attempt: Effect.Effect<A, E, R>,
) =>
	Effect.gen(function* () {
		yield* target({
			status: "active",
			failure: null,
		});
		return yield* attempt;
	}).pipe(
		Effect.catch((error) => {
			const failure =
				error instanceof AssetPipelineError ? error.failure : "other";
			return isRetryableFailure(failure)
				? target({
						failure,
					}).pipe(Effect.andThen(Effect.fail(error)))
				: target({
						status: "failed",
						failure,
					}).pipe(
						Effect.andThen(
							Effect.logWarning(
								{
									error,
									failure,
								},
								"Asset pipeline failed; retrying cannot help",
							),
						),
						Effect.as(undefined),
					);
		}),
	);

export const settleProcessingAttempt = <A, E, R>(
	assetId: AssetId,
	attempt: Effect.Effect<A, E, R>,
) => settleAttempt(processingTarget(assetId), attempt);

export const settleIndexingAttempt = <A, E, R>(
	link: {
		assetId: AssetId;
		blockId: BlockId;
	},
	attempt: Effect.Effect<A, E, R>,
) => settleAttempt(indexingTarget(link), attempt);

/**
 * A worker that outlives `expireInSeconds` fails the job with "handler
 * execution exceeded"; the supervisor fails a job whose worker is gone with
 * "job timed out" or "job heartbeat timeout".
 */
const TIMEOUT_MESSAGE =
	/^(handler execution exceeded|job timed out|job heartbeat timeout)/;

const timedOut = (job: JobWithMetadata<unknown>) => {
	const output = job.sourceOutput as {
		message?: unknown;
		value?: {
			message?: unknown;
		};
	} | null;
	return TIMEOUT_MESSAGE.test(
		String(output?.message ?? output?.value?.message ?? ""),
	);
};

const markExhausted = (target: Target, job: JobWithMetadata<unknown>) =>
	target({
		status: "failed",
		failure: timedOut(job) ? "timeout" : "recorded",
		unlessCompleted: true,
	});

/** Dead letter handler: processing ran out of retries. */
export const markProcessingExhausted = (
	jobs: JobWithMetadata<ProcessAssetPayload>[],
) =>
	Effect.forEach(
		jobs,
		(job) => markExhausted(processingTarget(job.data.assetRef.id), job),
		{
			discard: true,
		},
	);

/** Dead letter handler: indexing in one repository ran out of retries. */
export const markIndexingExhausted = (
	jobs: JobWithMetadata<VectorizeAssetPayload>[],
) =>
	Effect.forEach(jobs, (job) => markExhausted(indexingTarget(job.data), job), {
		discard: true,
	});
