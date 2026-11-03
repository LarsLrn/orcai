import { DB, dbSchema } from "@orcai/db";
import { liveJobs } from "@orcai/pg-boss";
import { activeGeneration } from "@orcai/qdrant";
import {
	GENERATE_ASSET_METADATA_DEAD_LETTER_JOB_NAME,
	GENERATE_ASSET_METADATA_JOB_NAME,
	type GenerateAssetMetadataPayload,
	type JobQueue,
	PROCESS_ASSET_DEAD_LETTER_JOB_NAME,
	PROCESS_ASSET_JOB_NAME,
	type ProcessAssetPayload,
	VECTORIZE_ASSET_DEAD_LETTER_JOB_NAME,
	VECTORIZE_ASSET_JOB_NAME,
	type VectorizeAssetPayload,
} from "@orcai/schema";
import { and, eq } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { waitingRun } from "./activity";
import {
	failStrandedIndexing,
	failStrandedMetadata,
	failStrandedProcessing,
	indexingAttempt,
	processingAttempt,
	unfinished,
} from "./attempt";

const PROCESSING = new Set<JobQueue>([
	PROCESS_ASSET_JOB_NAME,
	PROCESS_ASSET_DEAD_LETTER_JOB_NAME,
]);
const INDEXING = new Set<JobQueue>([
	VECTORIZE_ASSET_JOB_NAME,
	VECTORIZE_ASSET_DEAD_LETTER_JOB_NAME,
]);
const METADATA = new Set<JobQueue>([
	GENERATE_ASSET_METADATA_JOB_NAME,
	GENERATE_ASSET_METADATA_DEAD_LETTER_JOB_NAME,
]);

const processingKey = (attempt: { assetId: string; generation: number }) =>
	`processing:${attempt.assetId}:${attempt.generation}`;
const indexingKey = (attempt: {
	assetId: string;
	blockId: string;
	attempt: number;
}) => `indexing:${attempt.assetId}:${attempt.blockId}:${attempt.attempt}`;
const metadataKey = (attempt: { assetId: string; generation: number }) =>
	`metadata:${attempt.assetId}:${attempt.generation}`;

const jobKey = (job: { name: JobQueue; data: unknown }) =>
	PROCESSING.has(job.name)
		? processingKey(processingAttempt(job.data as ProcessAssetPayload))
		: INDEXING.has(job.name)
			? indexingKey(indexingAttempt(job.data as VectorizeAssetPayload))
			: metadataKey(job.data as GenerateAssetMetadataPayload);

/**
 * The stages still pending or active that no job will deliver again: their
 * job ran out of retries and its dead letter handler failed too, or retention
 * removed it. Links wait for the embedding setup and for processing without a
 * job, so only links of processed assets in the active generation count.
 */
export const strandedStages = Effect.gen(function* () {
	const db = yield* DB;
	const { asset, blockAsset } = dbSchema;

	// Stages before jobs: a job sent with a stage read here is still live
	// when the jobs are read, or its stage is no longer unfinished.
	const processing = yield* db
		.select({
			assetId: asset.id,
			generation: asset.processingGeneration,
		})
		.from(asset)
		.where(unfinished(asset.processingStatus));
	const metadata = yield* db
		.select({
			assetId: asset.id,
			generation: asset.metadataGeneration,
		})
		.from(asset)
		.where(unfinished(asset.metadataStatus));
	const generation = yield* activeGeneration;
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
						),
					);
	if (processing.length + metadata.length + indexing.length === 0) {
		return {
			processing,
			indexing,
			metadata,
		};
	}

	const live = new Set(
		(yield* liveJobs([
			...PROCESSING,
			...INDEXING,
			...METADATA,
		])).map(jobKey),
	);

	return {
		processing: processing.filter((stage) => !live.has(processingKey(stage))),
		indexing: indexing.filter((stage) => !live.has(indexingKey(stage))),
		metadata: metadata.filter((stage) => !live.has(metadataKey(stage))),
	};
});

export type StrandedStages = Effect.Success<typeof strandedStages>;

/**
 * Fails each stranded stage still on the attempt it was read on, with the
 * kind its attempt recorded, else `other`, so a person can prepare it again,
 * and its run's member with it. Returns how many it failed.
 */
export const failStrandedStages = (stages: StrandedStages) =>
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
							fromStoredExtraction: false,
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
		const count = failed.flat().filter(Boolean).length;
		if (count > 0) {
			yield* Effect.logWarning(
				{
					failed: count,
				},
				"Failed preparation stages no job will deliver again",
			);
		}
		return count;
	});

export const sweepPreparation = strandedStages.pipe(
	Effect.flatMap(failStrandedStages),
);
