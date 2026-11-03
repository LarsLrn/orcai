import type { ActivityRunId, AssetId, BlockId, UserId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { sendJobBatchInTransaction } from "@orcai/pg-boss";
import { activeGeneration } from "@orcai/qdrant";
import {
	GENERATE_ASSET_METADATA_JOB_NAME,
	type GenerateAssetMetadataPayload,
	type MetadataGenerationMode,
	type PipelineStatus,
	PROCESS_ASSET_JOB_NAME,
	type ProcessAssetPayload,
	VECTORIZE_ASSET_JOB_NAME,
	type VectorizeAssetPayload,
} from "@orcai/schema";
import {
	and,
	eq,
	exists,
	inArray,
	isNotNull,
	isNull,
	notInArray,
	or,
	sql,
} from "drizzle-orm";
import * as Effect from "effect/Effect";
import { admitStage, runActor, type StageTarget } from "./activity";
import { currentMetadata, failStrandedProcessing } from "./attempt";

const nextIndexAttempt = sql<number>`nextval('block_asset_index_attempt_seq')`;

/** An asset as the caller saw it: its processing generation then. */
export type ObservedAsset = {
	readonly id: AssetId;
	readonly generation: number;
};

/** A repository link as the caller saw it: its indexing attempt then. */
export type ObservedLink = {
	readonly assetId: AssetId;
	readonly blockId: BlockId;
	readonly attempt: number;
};

/**
 * The activity run whose work an admission is. Processing names the
 * repository the run indexes the asset in once it completes.
 */
export type AdmissionRun = {
	readonly id: ActivityRunId;
	readonly blockId?: BlockId;
};

export type Admission =
	| {
			readonly stage: "processing";
			readonly assets: readonly ObservedAsset[];
			/** The processing statuses the request may start a generation from. */
			readonly from: readonly PipelineStatus[];
			readonly run?: AdmissionRun;
			/**
			 * Keeps the assets, failed `other`, when the queue refuses their jobs,
			 * instead of failing the request: an upload creates its asset either way.
			 */
			readonly failWhenRefused?: boolean;
	  }
	| {
			readonly stage: "indexing";
			readonly links: readonly ObservedLink[];
			readonly run?: AdmissionRun;
			/** A re-embed: the stored extraction as it is. */
			readonly fromStoredExtraction?: boolean;
	  }
	| {
			readonly stage: "metadata";
			readonly assetIds: readonly AssetId[];
			readonly mode: MetadataGenerationMode;
			/** Whose quota the calls are metered against, else the uploader's. */
			readonly userId?: UserId;
			readonly onlyMissing?: boolean;
			readonly run?: AdmissionRun;
	  }
	| {
			readonly stage: "metadata";
			/** A delivery handing its request on to the next generation. */
			readonly continues: GenerateAssetMetadataPayload;
			/** Seconds before the next generation's job may run. */
			readonly startAfter: number;
	  };

/**
 * Starts the next processing generation of each asset whose generation is
 * still the one observed and whose processing is in `from`. Every repository
 * link turns pending with a new indexing attempt, so no repository claims
 * ready for vectors about to be replaced; processing admits their indexing
 * once it completes. The generation replaces every run's indexing waiting on
 * the asset, the run's own too.
 */
const admitProcessing = (
	admission: Extract<
		Admission,
		{
			stage: "processing";
		}
	>,
) =>
	Effect.gen(function* () {
		if (admission.assets.length === 0) return [];
		const db = yield* DB;
		const { activityMember, asset, blockAsset } = dbSchema;
		const { run } = admission;

		const admitted = yield* db
			.update(asset)
			.set({
				processingStatus: "pending",
				processingFailure: null,
				processingFailureId: null,
				processingActorId: runActor(run?.id),
				processingGeneration: sql`${asset.processingGeneration} + 1`,
			})
			.where(
				and(
					or(
						...admission.assets.map((observed) =>
							and(
								eq(asset.id, observed.id),
								eq(asset.processingGeneration, observed.generation),
							),
						),
					),
					inArray(asset.processingStatus, [
						...admission.from,
					]),
				),
			)
			.returning({
				id: asset.id,
				bucket: asset.bucket,
				prefix: asset.prefix,
				fileType: asset.fileType,
				generation: asset.processingGeneration,
			});
		if (admitted.length === 0) return [];
		const assetIds = admitted.map((row) => row.id);

		yield* db
			.update(blockAsset)
			.set({
				indexStatus: "pending",
				indexFailure: null,
				indexFailureId: null,
				indexAttempt: nextIndexAttempt,
			})
			.where(inArray(blockAsset.assetId, assetIds));
		const targets = admitted.map(
			(row): StageTarget => ({
				stage: "processing",
				assetId: row.id,
				blockId: run?.blockId,
			}),
		);
		yield* admitStage(run?.id, targets);
		yield* db
			.update(activityMember)
			.set({
				indexingState: "replaced",
			})
			.where(
				and(
					inArray(activityMember.assetId, assetIds),
					eq(activityMember.indexingState, "pending"),
				),
			);
		const queued = sendJobBatchInTransaction<ProcessAssetPayload>({
			jobName: PROCESS_ASSET_JOB_NAME,
			jobs: admitted.map((row) => ({
				data: {
					assetRef: {
						bucket: row.bucket,
						prefix: row.prefix,
						id: row.id,
						type: row.fileType,
					},
					generation: row.generation,
					runId: run?.id,
				},
			})),
		});
		// pg-boss refuses before any SQL, so the transaction stays usable.
		yield* admission.failWhenRefused
			? queued.pipe(
					Effect.catch((error) =>
						Effect.logError(
							{
								error,
							},
							"Asset processing not enqueued",
						).pipe(
							Effect.andThen(
								Effect.forEach(admitted, (row) =>
									failStrandedProcessing({
										assetId: row.id,
										generation: row.generation,
										runId: run?.id,
									}),
								),
							),
						),
					),
				)
			: queued;
		return targets;
	});

/**
 * Starts a new indexing attempt on each link whose attempt is still the one
 * observed, into the active embedding generation. A link another admission
 * got to first is left to it, so overlapping callers admit it once, and a
 * delivery of an earlier attempt changes nothing. Before embeddings are set
 * up the links wait without a job, automatic work the embedding reconciler
 * admits once they are.
 */
const admitIndexing = (
	admission: Extract<
		Admission,
		{
			stage: "indexing";
		}
	>,
) =>
	Effect.gen(function* () {
		if (admission.links.length === 0) return [];
		const db = yield* DB;
		const { blockAsset } = dbSchema;
		const runId = admission.run?.id;

		const generation = yield* activeGeneration;
		const admitted = yield* db
			.update(blockAsset)
			.set({
				indexStatus: "pending",
				indexFailure: null,
				indexFailureId: null,
				indexActorId: runActor(runId),
				indexAttempt: nextIndexAttempt,
				embeddingGeneration: generation ?? null,
			})
			.where(
				or(
					...admission.links.map((link) =>
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
		const targets = admitted.map(
			(link): StageTarget => ({
				stage: "indexing",
				assetId: link.assetId,
				blockId: link.blockId,
			}),
		);
		if (generation === undefined) {
			yield* admitStage(undefined, targets);
			return targets;
		}

		yield* admitStage(runId, targets);
		if (admitted.length > 0) {
			yield* sendJobBatchInTransaction<VectorizeAssetPayload>({
				jobName: VECTORIZE_ASSET_JOB_NAME,
				jobs: admitted.map((link) => ({
					data: {
						...link,
						runId,
						...(admission.fromStoredExtraction && {
							fromStoredExtraction: true,
						}),
					},
				})),
			});
		}
		return targets;
	});

/**
 * Starts the next metadata generation of each library asset whose
 * processing completed and whose organisation has a utility model. The new
 * generation replaces any suggestion, so a job or review of an earlier one
 * changes nothing. A `review` supersedes a generation in flight; an `apply`
 * skips such an asset, and with `onlyMissing` any asset that has metadata
 * generated already.
 */
const admitMetadata = (
	admission: Extract<
		Admission,
		{
			stage: "metadata";
			assetIds: unknown;
		}
	>,
) =>
	Effect.gen(function* () {
		if (admission.assetIds.length === 0) return [];
		const db = yield* DB;
		const { asset, organization, resourceScope } = dbSchema;
		const runId = admission.run?.id;

		const admitted = yield* db
			.update(asset)
			.set({
				metadataStatus: "pending",
				metadataFailure: null,
				metadataFailureId: null,
				metadataActorId: runActor(runId),
				metadataSuggestion: null,
				metadataGeneration: sql`${asset.metadataGeneration} + 1`,
			})
			.where(
				and(
					inArray(asset.id, [
						...admission.assetIds,
					]),
					eq(asset.keptIn, "library"),
					eq(asset.processingStatus, "completed"),
					exists(
						db
							.select({
								id: organization.id,
							})
							.from(resourceScope)
							.innerJoin(
								organization,
								eq(organization.id, resourceScope.organizationId),
							)
							.where(
								and(
									eq(resourceScope.resourceType, "asset"),
									eq(resourceScope.resourceId, asset.id),
									eq(resourceScope.isPrimary, true),
									isNull(resourceScope.endedAt),
									isNotNull(organization.utilityModelId),
								),
							),
					),
					admission.mode === "review"
						? undefined
						: or(
								isNull(asset.metadataStatus),
								admission.onlyMissing
									? eq(asset.metadataStatus, "failed")
									: notInArray(asset.metadataStatus, [
											"pending",
											"active",
										]),
							),
				),
			)
			.returning({
				assetId: asset.id,
				uploaderId: asset.userId,
				generation: asset.metadataGeneration,
			});
		if (admitted.length === 0) return [];

		const targets = admitted.map(
			(row): StageTarget => ({
				stage: "metadata",
				assetId: row.assetId,
			}),
		);
		yield* admitStage(runId, targets);
		yield* sendJobBatchInTransaction<GenerateAssetMetadataPayload>({
			jobName: GENERATE_ASSET_METADATA_JOB_NAME,
			jobs: admitted.map((row) => ({
				data: {
					assetId: row.assetId,
					userId: admission.userId ?? row.uploaderId,
					generation: row.generation,
					mode: admission.mode,
					runId,
				},
			})),
		});
		return targets;
	});

/**
 * Hands a delivery's request on to the asset's next metadata generation,
 * while the delivery's generation is still current: mode, user, run and the
 * run's pending member stay as they are. A newer request has replaced the
 * generation already, so it is never superseded.
 */
const continueMetadata = (
	admission: Extract<
		Admission,
		{
			continues: unknown;
		}
	>,
) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const { asset } = dbSchema;
		const data = admission.continues;

		const [next] = yield* db
			.update(asset)
			.set({
				metadataStatus: "pending",
				metadataGeneration: sql`${asset.metadataGeneration} + 1`,
			})
			.where(currentMetadata(data))
			.returning({
				generation: asset.metadataGeneration,
			});
		if (!next) return [];

		yield* sendJobBatchInTransaction<GenerateAssetMetadataPayload>({
			jobName: GENERATE_ASSET_METADATA_JOB_NAME,
			jobs: [
				{
					data: {
						...data,
						generation: next.generation,
					},
					options: {
						startAfter: admission.startAfter,
					},
				},
			],
		});
		return [
			{
				stage: "metadata",
				assetId: data.assetId,
			} satisfies StageTarget,
		];
	});

/**
 * The one way preparation work starts: moves each target the request may
 * admit to pending under a fenced write, records the run's member, and
 * queues the target's job, all in one transaction, the caller's when it has
 * one. The work is the run's, or automatic without it. Returns the targets
 * admitted.
 */
export const admit = (admission: Admission) =>
	Effect.gen(function* () {
		const db = yield* DB;
		return yield* db.transaction(() =>
			Effect.gen(function* () {
				switch (admission.stage) {
					case "processing":
						return yield* admitProcessing(admission);
					case "indexing":
						return yield* admitIndexing(admission);
					case "metadata":
						return "continues" in admission
							? yield* continueMetadata(admission)
							: yield* admitMetadata(admission);
				}
			}),
		);
	});
