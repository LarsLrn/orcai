import type { ActivityRunId, AssetId, BlockId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import type { JobWithMetadata } from "@orcai/pg-boss";
import { StaleEmbeddingGenerationError } from "@orcai/qdrant";
import {
	type GenerateAssetMetadataPayload,
	isTransientFailure,
	type PipelineFailure,
	type ProcessAssetPayload,
	type VectorizeAssetPayload,
} from "@orcai/schema";
import { and, type Column, eq, sql } from "drizzle-orm";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import { newFailureId, type StageTarget, settleStage } from "./activity";
import { reconcileLinkPoints } from "./link-points";

/** An attempt failed for a known reason. Any other error counts as `other`. */
export class AssetPipelineError extends Data.TaggedError("AssetPipelineError")<{
	readonly failure: PipelineFailure;
	readonly cause: unknown;
}> {}

/** The attempt was replaced, or its asset deleted, before it could write. */
class AttemptReplacedError extends Data.TaggedError("AttemptReplacedError") {}

/** A processing delivery's attempt: the asset's generation it was queued for. */
export type ProcessingAttempt = {
	readonly assetId: AssetId;
	readonly generation: number;
	/** The activity run whose work it is. */
	readonly runId?: ActivityRunId;
};

/** An indexing delivery's attempt: the link's attempt it was queued for. */
export type IndexingAttempt = {
	readonly assetId: AssetId;
	readonly blockId: BlockId;
	readonly attempt: number;
	readonly runId?: ActivityRunId;
};

/** A metadata delivery's attempt: the asset's generation it was queued for. */
export type MetadataAttempt = {
	readonly assetId: AssetId;
	readonly generation: number;
	readonly runId?: ActivityRunId;
};

export const processingAttempt = (
	data: ProcessAssetPayload,
): ProcessingAttempt => ({
	assetId: data.assetRef.id,
	generation: data.generation,
	runId: data.runId,
});

export const indexingAttempt = (
	data: VectorizeAssetPayload,
): IndexingAttempt => ({
	assetId: data.assetId,
	blockId: data.blockId,
	attempt: data.attempt,
	runId: data.runId,
});

/** Literal, so the unfinished-stage partial indexes serve generic plans too. */
export const unfinished = (status: Column) =>
	sql`${status} in ('pending', 'active')`;

/** The asset, while `attempt` is its current processing and unfinished. */
export const currentProcessing = (attempt: ProcessingAttempt) =>
	and(
		eq(dbSchema.asset.id, attempt.assetId),
		eq(dbSchema.asset.processingGeneration, attempt.generation),
		unfinished(dbSchema.asset.processingStatus),
	);

/**
 * Runs `write` while `attempt` is the asset's current processing, keeping the
 * asset from being deleted until it ends, so storage written for a deleted
 * asset is always in its deletion's cleanup. Fails with
 * {@link AttemptReplacedError} otherwise. Uninterruptible, so a write in
 * flight keeps the asset until it settles.
 */
export const writeWhileProcessing = <A, E, R>(
	attempt: ProcessingAttempt,
	write: Effect.Effect<A, E, R>,
) =>
	Effect.gen(function* () {
		const db = yield* DB;
		return yield* Effect.uninterruptible(
			db.transaction(() =>
				Effect.gen(function* () {
					const [current] = yield* db
						.select({
							id: dbSchema.asset.id,
						})
						.from(dbSchema.asset)
						.where(currentProcessing(attempt))
						.for("key share");
					if (!current) return yield* new AttemptReplacedError();
					return yield* write;
				}),
			),
		);
	});

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

const failureValue = (failure: Write["failure"], column: Column) =>
	failure === "recorded" ? sql`coalesce(${column}, 'other')` : failure;

/**
 * Runs the attempt's fenced write; when it failed the target, records the
 * failure on the run's member in the same transaction.
 */
const fencedWrite = <E>(
	values: Write,
	runId: ActivityRunId | undefined,
	stage: StageTarget,
	write: Effect.Effect<
		{
			failureId: string | null;
		}[],
		E,
		DB
	>,
) =>
	Effect.gen(function* () {
		const db = yield* DB;
		return yield* db.transaction(() =>
			Effect.gen(function* () {
				const [written] = yield* write;
				if (!written) return false;
				if (values.status === "failed") {
					yield* settleStage(runId, stage, {
						state: "failed",
						failureId: written.failureId,
					});
				}
				return true;
			}),
		);
	});

const failureIdValue = (values: Write) =>
	values.status === "failed" ? newFailureId : undefined;

const processingTarget = (attempt: ProcessingAttempt) => (values: Write) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const { asset } = dbSchema;
		return yield* fencedWrite(
			values,
			attempt.runId,
			{
				stage: "processing",
				assetId: attempt.assetId,
			},
			db
				.update(asset)
				.set({
					processingStatus: values.status,
					processingFailure: failureValue(
						values.failure,
						asset.processingFailure,
					),
					processingFailureId: failureIdValue(values),
				})
				.where(currentProcessing(attempt))
				.returning({
					failureId: asset.processingFailureId,
				}),
		);
	});

/** The link's indexing; with `generation`, only while admitted into it. */
const indexingTarget =
	(attempt: IndexingAttempt, generation?: number) => (values: Write) =>
		Effect.gen(function* () {
			const db = yield* DB;
			const { blockAsset } = dbSchema;
			return yield* fencedWrite(
				values,
				attempt.runId,
				{
					stage: "indexing",
					assetId: attempt.assetId,
					blockId: attempt.blockId,
				},
				db
					.update(blockAsset)
					.set({
						indexStatus: values.status,
						indexFailure: failureValue(values.failure, blockAsset.indexFailure),
						indexFailureId: failureIdValue(values),
					})
					.where(
						and(
							currentIndexing(attempt),
							generation === undefined
								? undefined
								: eq(blockAsset.embeddingGeneration, generation),
						),
					)
					.returning({
						failureId: blockAsset.indexFailureId,
					}),
			);
		});

const metadataTarget = (attempt: MetadataAttempt) => (values: Write) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const { asset } = dbSchema;
		return yield* fencedWrite(
			values,
			attempt.runId,
			{
				stage: "metadata",
				assetId: attempt.assetId,
			},
			db
				.update(asset)
				.set({
					metadataStatus: values.status,
					metadataFailure: failureValue(values.failure, asset.metadataFailure),
					metadataFailureId: failureIdValue(values),
				})
				.where(currentMetadata(attempt))
				.returning({
					failureId: asset.metadataFailureId,
				}),
		);
	});

/** Writes while the attempt is current and unfinished; whether it was. */
type Target = ReturnType<typeof processingTarget>;

const claim = (target: Target) =>
	target({
		status: "active",
		failure: null,
	});

/** The asset's file type when the delivery may run: its generation is current and unfinished, now active. */
export const claimMetadata = (attempt: MetadataAttempt) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const { asset } = dbSchema;
		const [claimed] = yield* db
			.update(asset)
			.set({
				metadataStatus: "active",
				metadataFailure: null,
			})
			.where(currentMetadata(attempt))
			.returning({
				fileType: asset.fileType,
			});
		return claimed?.fileType;
	});

/** Whether the delivery may run: its attempt is current and unfinished, now active. */
export const claimProcessing = (attempt: ProcessingAttempt) =>
	claim(processingTarget(attempt));

/**
 * Whether the delivery may run on the embedding generation: its attempt is
 * current, unfinished and admitted into that generation, now active.
 */
export const claimIndexing = (attempt: IndexingAttempt, generation: number) =>
	claim(indexingTarget(attempt, generation));

/**
 * Runs a claimed attempt and keeps the stored status honest. A transient
 * failure records its kind and fails the job so pg-boss retries it; the dead
 * letter handler marks it failed once retries run out. Any other failure
 * marks it failed at once and completes the job. The attempt writes
 * completed itself. Once a newer attempt or embedding generation replaced it,
 * it writes nothing and is not retried.
 */
const settleAttempt = <A, E, R>(
	target: Target,
	attempt: Effect.Effect<A, E, R>,
) =>
	attempt.pipe(
		Effect.catch((error) => {
			if (error instanceof AttemptReplacedError) {
				return Effect.logInfo(
					"Not writing for an attempt that was replaced or deleted",
				);
			}
			if (error instanceof StaleEmbeddingGenerationError) {
				return Effect.logInfo(
					{
						error,
					},
					"Not retrying an attempt whose embedding generation was replaced",
				);
			}
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

const stranded: Write = {
	status: "failed",
	failure: "recorded",
};

/** Dead letter handler: processing ran out of retries. */
export const markProcessingExhausted = (
	job: JobWithMetadata<ProcessAssetPayload>,
) => markExhausted(processingTarget(processingAttempt(job.data)), job);

/** Dead letter handler: indexing in one repository ran out of retries. */
export const markIndexingExhausted = (
	job: JobWithMetadata<VectorizeAssetPayload>,
) => {
	const attempt = indexingAttempt(job.data);
	return markExhausted(indexingTarget(attempt), job).pipe(
		Effect.andThen(reconcileLinkPoints(attempt)),
	);
};

/** Dead letter handler: a metadata generation ran out of retries. */
export const markMetadataExhausted = (
	job: JobWithMetadata<GenerateAssetMetadataPayload>,
) => markExhausted(metadataTarget(job.data), job);

/** The sweep: processing no job will deliver again failed with its recorded kind. */
export const failStrandedProcessing = (attempt: ProcessingAttempt) =>
	processingTarget(attempt)(stranded);

/** The sweep: indexing no job will deliver again failed with its recorded kind. */
export const failStrandedIndexing = (attempt: IndexingAttempt) =>
	indexingTarget(attempt)(stranded).pipe(
		Effect.tap((failed) =>
			failed ? reconcileLinkPoints(attempt) : Effect.void,
		),
	);

/** The sweep: metadata no job will deliver again failed with its recorded kind. */
export const failStrandedMetadata = (attempt: MetadataAttempt) =>
	metadataTarget(attempt)(stranded);
