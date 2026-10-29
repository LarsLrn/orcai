import type { AssetId, BlockId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { type JobWithMetadata, reconcileLinkPoints } from "@orcai/pg-boss";
import {
	type GenerateAssetMetadataPayload,
	isTransientFailure,
	type PipelineFailure,
	type ProcessAssetPayload,
	type VectorizeAssetPayload,
} from "@orcai/schema";
import { and, type Column, eq, inArray, sql } from "drizzle-orm";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";

/** An attempt failed for a known reason. Any other error counts as `other`. */
export class AssetPipelineError extends Data.TaggedError("AssetPipelineError")<{
	readonly failure: PipelineFailure;
	readonly cause: unknown;
}> {}

/** A processing delivery's attempt: the asset's generation it was queued for. */
export type ProcessingAttempt = {
	readonly assetId: AssetId;
	readonly generation: number;
};

/** An indexing delivery's attempt: the link's attempt it was queued for. */
export type IndexingAttempt = {
	readonly assetId: AssetId;
	readonly blockId: BlockId;
	readonly attempt: number;
};

/** A metadata delivery's attempt: the asset's generation it was queued for. */
export type MetadataAttempt = {
	readonly assetId: AssetId;
	readonly generation: number;
};

export const processingAttempt = (
	data: ProcessAssetPayload,
): ProcessingAttempt => ({
	assetId: data.assetRef.id,
	generation: data.generation ?? 0,
});

export const indexingAttempt = (
	data: VectorizeAssetPayload,
): IndexingAttempt => ({
	assetId: data.assetId,
	blockId: data.blockId,
	attempt: data.attempt ?? 0,
});

const unfinished = (status: Column) =>
	inArray(status, [
		"pending",
		"active",
	]);

/** The asset, while `attempt` is its current processing and unfinished. */
export const currentProcessing = (attempt: ProcessingAttempt) =>
	and(
		eq(dbSchema.asset.id, attempt.assetId),
		eq(dbSchema.asset.processingGeneration, attempt.generation),
		unfinished(dbSchema.asset.processingStatus),
	);

/** The repository link, while `attempt` is its current indexing and unfinished. */
export const currentIndexing = (attempt: IndexingAttempt) =>
	and(
		eq(dbSchema.blockAsset.assetId, attempt.assetId),
		eq(dbSchema.blockAsset.blockId, attempt.blockId),
		eq(dbSchema.blockAsset.indexAttempt, attempt.attempt),
		unfinished(dbSchema.blockAsset.indexStatus),
	);

/** The asset, while `attempt` is its current metadata generation and unfinished. */
export const currentMetadata = (attempt: MetadataAttempt) =>
	and(
		eq(dbSchema.asset.id, attempt.assetId),
		eq(dbSchema.asset.metadataGeneration, attempt.generation),
		unfinished(dbSchema.asset.metadataStatus),
	);

type Write = {
	readonly status?: "active" | "failed";
	/** `recorded` keeps the kind an earlier attempt stored, else `other`. */
	readonly failure: PipelineFailure | "recorded" | null;
};

/** Writes while the attempt is current and unfinished; whether it was. */
type Target = (values: Write) => Effect.Effect<boolean, unknown, DB>;

const failureValue = (failure: Write["failure"], column: Column) =>
	failure === "recorded" ? sql`coalesce(${column}, 'other')` : failure;

const processingTarget =
	(attempt: ProcessingAttempt): Target =>
	(values) =>
		Effect.gen(function* () {
			const db = yield* DB;
			const { asset } = dbSchema;
			const written = yield* db
				.update(asset)
				.set({
					processingStatus: values.status,
					processingFailure: failureValue(
						values.failure,
						asset.processingFailure,
					),
				})
				.where(currentProcessing(attempt))
				.returning({
					id: asset.id,
				});
			return written.length > 0;
		});

const indexingTarget =
	(attempt: IndexingAttempt): Target =>
	(values) =>
		Effect.gen(function* () {
			const db = yield* DB;
			const { blockAsset } = dbSchema;
			const written = yield* db
				.update(blockAsset)
				.set({
					indexStatus: values.status,
					indexFailure: failureValue(values.failure, blockAsset.indexFailure),
				})
				.where(currentIndexing(attempt))
				.returning({
					assetId: blockAsset.assetId,
				});
			return written.length > 0;
		});

const metadataTarget =
	(attempt: MetadataAttempt): Target =>
	(values) =>
		Effect.gen(function* () {
			const db = yield* DB;
			const { asset } = dbSchema;
			const written = yield* db
				.update(asset)
				.set({
					metadataStatus: values.status,
					metadataFailure: failureValue(values.failure, asset.metadataFailure),
				})
				.where(currentMetadata(attempt))
				.returning({
					id: asset.id,
				});
			return written.length > 0;
		});

const claim = (target: Target) =>
	target({
		status: "active",
		failure: null,
	});

/** Whether the delivery may run: its attempt is current and unfinished, now active. */
export const claimProcessing = (attempt: ProcessingAttempt) =>
	claim(processingTarget(attempt));

/** Whether the delivery may run: its attempt is current and unfinished, now active. */
export const claimIndexing = (attempt: IndexingAttempt) =>
	claim(indexingTarget(attempt));

/**
 * Runs a claimed attempt and keeps the stored status honest. A transient
 * failure records its kind and fails the job so pg-boss retries it; the dead
 * letter handler marks it failed once retries run out. Any other failure
 * marks it failed at once and completes the job. The attempt writes
 * completed itself. Once a newer attempt replaced it, it writes nothing and
 * is not retried.
 */
const settleAttempt = <A, E, R>(
	target: Target,
	attempt: Effect.Effect<A, E, R>,
) =>
	attempt.pipe(
		Effect.catch((error) => {
			const failure =
				error instanceof AssetPipelineError ? error.failure : "other";
			return isTransientFailure(failure)
				? target({
						failure,
					}).pipe(
						Effect.flatMap((current) =>
							current
								? Effect.fail(error)
								: Effect.logInfo(
										{
											error,
										},
										"Not retrying an attempt that was replaced",
									),
						),
					)
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
					);
		}),
	);

export const settleProcessingAttempt = <A, E, R>(
	attempt: ProcessingAttempt,
	run: Effect.Effect<A, E, R>,
) => settleAttempt(processingTarget(attempt), run);

export const settleIndexingAttempt = <A, E, R>(
	attempt: IndexingAttempt,
	run: Effect.Effect<A, E, R>,
) => settleAttempt(indexingTarget(attempt), run);

export const settleMetadataAttempt = <A, E, R>(
	attempt: MetadataAttempt,
	run: Effect.Effect<A, E, R>,
) => settleAttempt(metadataTarget(attempt), run);

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
	});

/** Dead letter handler: processing ran out of retries. */
export const markProcessingExhausted = (
	jobs: JobWithMetadata<ProcessAssetPayload>[],
) =>
	Effect.forEach(
		jobs,
		(job) => markExhausted(processingTarget(processingAttempt(job.data)), job),
		{
			discard: true,
		},
	);

/** Dead letter handler: indexing in one repository ran out of retries. */
export const markIndexingExhausted = (
	jobs: JobWithMetadata<VectorizeAssetPayload>[],
) =>
	Effect.forEach(
		jobs,
		(job) => {
			const attempt = indexingAttempt(job.data);
			return markExhausted(indexingTarget(attempt), job).pipe(
				Effect.andThen(reconcileLinkPoints(attempt)),
			);
		},
		{
			discard: true,
		},
	);

/** Dead letter handler: a metadata generation ran out of retries. */
export const markMetadataExhausted = (
	jobs: JobWithMetadata<GenerateAssetMetadataPayload>[],
) =>
	Effect.forEach(jobs, (job) => markExhausted(metadataTarget(job.data), job), {
		discard: true,
	});
