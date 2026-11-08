import type { AssetId, BlockId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { liveJobs } from "@orcai/pg-boss";
import { activeGeneration } from "@orcai/qdrant";
import {
	GENERATE_ASSET_METADATA_DEAD_LETTER_JOB_NAME,
	GENERATE_ASSET_METADATA_JOB_NAME,
	type GenerateAssetMetadataPayload,
	type JobQueue,
	PREPARE_MISSING_EXTRACTIONS_AGAIN_JOB_NAME,
	PROCESS_ASSET_DEAD_LETTER_JOB_NAME,
	PROCESS_ASSET_JOB_NAME,
	type PrepareMissingExtractionsAgainPayload,
	type ProcessAssetPayload,
	VECTORIZE_ASSET_DEAD_LETTER_JOB_NAME,
	VECTORIZE_ASSET_JOB_NAME,
	type VectorizeAssetPayload,
} from "@orcai/schema";
import { and, asc, eq, gt, inArray, sql } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { waitingRun } from "./activity";
import {
	failStrandedIndexing,
	failStrandedMetadata,
	failStrandedProcessing,
	type IndexingAttempt,
	indexingAttempt,
	type MetadataAttempt,
	type ProcessingAttempt,
	processingAttempt,
	unfinished,
} from "./attempt";
import { JOB_LEASE } from "./runs";

const PROCESSING_QUEUES: readonly JobQueue[] = [
	PROCESS_ASSET_JOB_NAME,
	PROCESS_ASSET_DEAD_LETTER_JOB_NAME,
];
const INDEXING_QUEUES: readonly JobQueue[] = [
	VECTORIZE_ASSET_JOB_NAME,
	VECTORIZE_ASSET_DEAD_LETTER_JOB_NAME,
];
const METADATA_QUEUES: readonly JobQueue[] = [
	GENERATE_ASSET_METADATA_JOB_NAME,
	GENERATE_ASSET_METADATA_DEAD_LETTER_JOB_NAME,
];

/** Where a pass of the sweep goes on reading each stage; a stage read to its end is absent. */
export type SweepCursor = {
	readonly processing?: {
		readonly after?: AssetId;
	};
	readonly metadata?: {
		readonly after?: AssetId;
	};
	readonly indexing?: {
		readonly after?: {
			readonly assetId: AssetId;
			readonly blockId: BlockId;
		};
	};
};

export const SWEEP_START: SweepCursor = {
	processing: {},
	metadata: {},
	indexing: {},
};

/** Candidates per stage in one batch of the sweep. */
const SWEEP_BATCH = 1000;

/** Unfinished stages at the attempts the sweep read them on. */
export type StageAttempts = {
	readonly processing: readonly ProcessingAttempt[];
	readonly indexing: readonly IndexingAttempt[];
	readonly metadata: readonly MetadataAttempt[];
};

/**
 * The batch of stages after `cursor` still pending or active. Links wait for
 * the embedding setup and for processing without a job, so only links of
 * processed assets in the active generation count. `next` is where the
 * following batch starts, absent after the last.
 */
export const unfinishedStages = (cursor: SweepCursor, limit = SWEEP_BATCH) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const { asset, blockAsset } = dbSchema;

		const processing = cursor.processing
			? yield* db
					.select({
						assetId: asset.id,
						generation: asset.processingGeneration,
					})
					.from(asset)
					.where(
						and(
							unfinished(asset.processingStatus),
							cursor.processing.after
								? gt(asset.id, cursor.processing.after)
								: undefined,
						),
					)
					.orderBy(asc(asset.id))
					.limit(limit)
			: [];
		const metadata = cursor.metadata
			? yield* db
					.select({
						assetId: asset.id,
						generation: asset.metadataGeneration,
					})
					.from(asset)
					.where(
						and(
							unfinished(asset.metadataStatus),
							cursor.metadata.after
								? gt(asset.id, cursor.metadata.after)
								: undefined,
						),
					)
					.orderBy(asc(asset.id))
					.limit(limit)
			: [];
		const generation = cursor.indexing ? yield* activeGeneration : undefined;
		const linksAfter = cursor.indexing?.after;
		const indexing =
			generation === undefined
				? []
				: yield* db
						.select({
							assetId: blockAsset.assetId,
							blockId: blockAsset.blockId,
							attempt: blockAsset.indexAttempt,
						})
						.from(blockAsset)
						.innerJoin(asset, eq(asset.id, blockAsset.assetId))
						.where(
							and(
								unfinished(blockAsset.indexStatus),
								eq(blockAsset.embeddingGeneration, generation),
								eq(asset.processingStatus, "completed"),
								linksAfter
									? sql`(${blockAsset.assetId}, ${blockAsset.blockId}) > (${linksAfter.assetId}, ${linksAfter.blockId})`
									: undefined,
							),
						)
						.orderBy(asc(blockAsset.assetId), asc(blockAsset.blockId))
						.limit(limit);

		const full = <A>(rows: readonly A[]) =>
			rows.length > 0 && rows.length === limit;
		const next: SweepCursor = {
			processing: full(processing)
				? {
						after: processing[processing.length - 1].assetId,
					}
				: undefined,
			metadata: full(metadata)
				? {
						after: metadata[metadata.length - 1].assetId,
					}
				: undefined,
			indexing: full(indexing)
				? {
						after: {
							assetId: indexing[indexing.length - 1].assetId,
							blockId: indexing[indexing.length - 1].blockId,
						},
					}
				: undefined,
		};
		return {
			processing,
			indexing,
			metadata,
			next:
				next.processing || next.metadata || next.indexing ? next : undefined,
		};
	});

/** The attempts no job in `queues` is left for, matched on the payload fields at `paths`. */
const withoutJob = <A, P>(
	attempts: readonly A[],
	queues: readonly JobQueue[],
	paths: readonly (readonly string[])[],
	fields: (attempt: A) => readonly string[],
	attemptOf: (payload: P) => A,
) =>
	Effect.gen(function* () {
		const jobs = yield* liveJobs<P>(queues, {
			paths,
			values: attempts.map(fields),
		});
		const key = (attempt: A) => fields(attempt).join(":");
		const live = new Set(jobs.map((job) => key(attemptOf(job.data))));
		return attempts.filter((attempt) => !live.has(key(attempt)));
	});

const generationFields = (attempt: { assetId: string; generation: number }) => [
	attempt.assetId,
	String(attempt.generation),
];

/**
 * The stages no job will deliver again: their job ran out of retries and its
 * dead letter handler failed too, or retention removed it. Read the stages
 * first: a job sent for a stage read before is live now, or its stage is no
 * longer unfinished.
 */
export const withoutLiveJobs = (stages: StageAttempts) =>
	Effect.gen(function* () {
		const processing = yield* withoutJob(
			stages.processing,
			PROCESSING_QUEUES,
			[
				[
					"assetRef",
					"id",
				],
				[
					"generation",
				],
			],
			generationFields,
			(payload: ProcessAssetPayload) => processingAttempt(payload),
		);
		const indexing = yield* withoutJob(
			stages.indexing,
			INDEXING_QUEUES,
			[
				[
					"assetId",
				],
				[
					"blockId",
				],
				[
					"attempt",
				],
			],
			(attempt) => [
				attempt.assetId,
				attempt.blockId,
				String(attempt.attempt),
			],
			(payload: VectorizeAssetPayload) => indexingAttempt(payload),
		);
		const metadata = yield* withoutJob(
			stages.metadata,
			METADATA_QUEUES,
			[
				[
					"assetId",
				],
				[
					"generation",
				],
			],
			generationFields,
			(payload: GenerateAssetMetadataPayload): MetadataAttempt => payload,
		);
		return {
			processing,
			indexing,
			metadata,
		} satisfies StageAttempts;
	});

/**
 * Fails each stranded stage still on the attempt it was read on, with the
 * kind its attempt recorded, else `other`, so a person can prepare it again,
 * and its run's member with it. Returns how many it failed.
 */
export const failStrandedStages = (stages: StageAttempts) =>
	Effect.gen(function* () {
		const failed = yield* Effect.all([
			Effect.forEach(stages.processing, (stage) =>
				waitingRun({
					stage: "processing",
					assetId: stage.assetId,
				}).pipe(
					Effect.flatMap((runId) =>
						failStrandedProcessing({
							...stage,
							runId,
						}),
					),
				),
			),
			Effect.forEach(stages.indexing, (stage) =>
				waitingRun({
					stage: "indexing",
					assetId: stage.assetId,
					blockId: stage.blockId,
				}).pipe(
					Effect.flatMap((runId) =>
						failStrandedIndexing({
							...stage,
							runId,
						}),
					),
				),
			),
			Effect.forEach(stages.metadata, (stage) =>
				waitingRun({
					stage: "metadata",
					assetId: stage.assetId,
				}).pipe(
					Effect.flatMap((runId) =>
						failStrandedMetadata({
							...stage,
							runId,
						}),
					),
				),
			),
		]);
		return failed.flat().filter(Boolean).length;
	});

/** Fails the stranded stages batch by batch, each batch read before it is failed. */
const sweepStrandedStages = Effect.gen(function* () {
	let cursor: SweepCursor | undefined = SWEEP_START;
	let failed = 0;
	while (cursor) {
		const batch: Effect.Success<ReturnType<typeof unfinishedStages>> =
			yield* unfinishedStages(cursor);
		failed += yield* failStrandedStages(yield* withoutLiveJobs(batch));
		cursor = batch.next;
	}
	if (failed > 0) {
		yield* Effect.logWarning(
			{
				failed,
			},
			"Failed preparation stages no job will deliver again",
		);
	}
});

/**
 * The run leases of preparation jobs that are gone: a job that ran out of
 * retries, or that retention removed, never releases its own.
 */
export const strandedJobLeases = Effect.gen(function* () {
	const db = yield* DB;
	const { activityAdmission } = dbSchema;
	// Leases before jobs: a lease read here with its job sent is live when the jobs are read.
	const leases = yield* db
		.select({
			id: activityAdmission.id,
		})
		.from(activityAdmission)
		.where(eq(activityAdmission.leaseUntil, JOB_LEASE));
	if (leases.length === 0) return [];
	const live = new Set(
		(yield* liveJobs<PrepareMissingExtractionsAgainPayload>([
			PREPARE_MISSING_EXTRACTIONS_AGAIN_JOB_NAME,
		])).map((job) => job.data.leaseId),
	);
	return leases.map((lease) => lease.id).filter((id) => !live.has(id));
});

/** Releases the leases, so their runs finish once their work is done. */
export const releaseJobLeases = (leaseIds: readonly string[]) =>
	Effect.gen(function* () {
		if (leaseIds.length === 0) return;
		const db = yield* DB;
		yield* db.delete(dbSchema.activityAdmission).where(
			inArray(dbSchema.activityAdmission.id, [
				...leaseIds,
			]),
		);
		yield* Effect.logWarning(
			{
				released: leaseIds.length,
			},
			"Released run leases of preparation jobs that are gone",
		);
	});

export const sweepPreparation = Effect.all([
	sweepStrandedStages,
	strandedJobLeases.pipe(Effect.flatMap(releaseJobLeases)),
]);
