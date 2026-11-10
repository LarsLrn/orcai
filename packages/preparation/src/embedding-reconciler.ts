import type { ActivityRunId, OrganizationId, UserId } from "@orcai/core";
import { advisoryXactLock, DB, dbSchema, homeScopeOf } from "@orcai/db";
import { liveJobs, sendJobBatchInTransaction } from "@orcai/pg-boss";
import {
	EmbeddingIndex,
	holdGeneration,
	maintainCollections,
} from "@orcai/qdrant";
import {
	isRetryableFailure,
	PIPELINE_FAILURES,
	type PipelineFailure,
	PREPARE_ASSETS_AGAIN_JOB_NAME,
	type PrepareAgainScope,
	type PrepareAssetsAgainPayload,
} from "@orcai/schema";
import {
	and,
	desc,
	eq,
	exists,
	gte,
	inArray,
	isNotNull,
	isNull,
	lt,
	notExists,
	notInArray,
	or,
	sql,
} from "drizzle-orm";
import * as Effect from "effect/Effect";
import { runningRun, type StageTarget } from "./activity";
import { type AdmissionRun, admit, type ObservedLink } from "./admission";
import { inActivityRun, leaseHeld, leaseRun, releaseAdmission } from "./runs";

const ADMISSION_BATCH = 500;

/** Links one run embeds again for a new title; the next run takes the rest. */
const RETITLE_BUDGET = 100;

/** How long an asset's title stays unchanged before its passages are embedded below it again, so a burst of renames embeds once. */
const RETITLE_QUIET = sql`interval '30 seconds'`;

/** How far back a title change is looked for, so a run reads only recently changed assets. */
const RETITLE_WINDOW = sql`interval '1 day'`;

/**
 * Failures embedding the stored extraction again can help. A missing
 * extraction needs its asset prepared again instead.
 */
const REEMBEDDABLE_FAILURES: readonly PipelineFailure[] =
	PIPELINE_FAILURES.filter(
		(failure) =>
			isRetryableFailure(failure) && failure !== "missing_extraction",
	);

/**
 * The links the active generation embeds: every repository link of a
 * prepared asset, within the index's repositories. Join `settings` too.
 */
const embeddable = Effect.gen(function* () {
	const { settings, blockIds } = yield* EmbeddingIndex;
	const { asset, blockAsset } = dbSchema;
	const db = yield* DB;
	const inIndex = (...conditions: ReturnType<typeof and>[]) =>
		and(
			blockIds
				? inArray(blockAsset.blockId, [
						...blockIds,
					])
				: undefined,
			...conditions,
		);
	const inActive = sql`${blockAsset.embeddingGeneration} is not distinct from ${settings.embeddingGeneration}`;
	return {
		links: () =>
			db
				.select({
					assetId: blockAsset.assetId,
					blockId: blockAsset.blockId,
					attempt: blockAsset.indexAttempt,
				})
				.from(blockAsset)
				.innerJoin(asset, eq(asset.id, blockAsset.assetId))
				.innerJoin(settings, sql`${settings.embeddingGeneration} is not null`),
		where: (...conditions: ReturnType<typeof and>[]) =>
			inIndex(eq(asset.processingStatus, "completed"), ...conditions),
		/**
		 * The links counted toward a generation: those `where` selects, and
		 * those of an asset being prepared again after it was indexed in any
		 * generation, which its processing indexes in the active one.
		 */
		counted: (...conditions: ReturnType<typeof and>[]) =>
			inIndex(
				or(
					eq(asset.processingStatus, "completed"),
					and(
						inArray(asset.processingStatus, [
							"pending",
							"active",
						]),
						isNotNull(blockAsset.embeddingGeneration),
					),
				),
				...conditions,
			),
		inActive,
		settled: and(
			inActive,
			inArray(blockAsset.indexStatus, [
				"completed",
				"failed",
			]),
		),
	};
});

/** Admits `select`'s links, a batch at a time, to embed their stored extraction again, as the run's work. */
const admitAll = <E, R>(
	select: () => Effect.Effect<readonly ObservedLink[], E, R>,
	run?: AdmissionRun,
) =>
	Effect.gen(function* () {
		let admitted = 0;
		while (true) {
			const links = yield* select();
			if (links.length === 0) return admitted;
			const queued = yield* admit({
				stage: "indexing",
				links,
				run,
			});
			admitted += queued.length;
			// Every link went to another admission meanwhile; the next run looks again.
			if (queued.length === 0) return admitted;
		}
	});

/** The active generation, and whether some counted link has not settled in it since it started. */
const rebuildState = Effect.gen(function* () {
	const db = yield* DB;
	const { settings } = yield* EmbeddingIndex;
	const links = yield* embeddable;
	const [row] = yield* db
		.select({
			generation: settings.embeddingGeneration,
			rebuilding: sql<boolean>`${settings.embeddingRebuilding} and exists (${links
				.links()
				.where(links.counted(sql`not (${links.settled})`))
				.limit(1)})`,
		})
		.from(settings);
	return {
		generation: row?.generation ?? undefined,
		rebuilding: row?.rebuilding ?? false,
	};
});

/**
 * Whether files are being re-embedded after a new generation started: some
 * counted link has not settled in it yet. Search finds only the
 * links already embedded meanwhile.
 */
export const embeddingsRebuilding = rebuildState.pipe(
	Effect.map(({ rebuilding }) => rebuilding),
);

/**
 * Brings every repository link onto the active embedding generation. Keeps
 * Qdrant's collections on it, then admits, a batch at a time, each link of a
 * prepared asset whose indexing targets another generation or none, to embed
 * its stored extraction again. It is how waiting links, a new generation and
 * work lost to a crash get indexed; idempotent, so every run resumes where
 * the last one stopped. A rebuild ends once every link has settled. Then
 * admits up to a budget of indexed links whose passages were embedded below
 * another title than their asset's, changed in the last day, once the asset
 * is unchanged for a while and its metadata is not being generated. Does
 * nothing before setup. Returns the links admitted.
 */
export const reconcileEmbeddings = Effect.gen(function* () {
	yield* maintainCollections;
	const db = yield* DB;
	const { settings } = yield* EmbeddingIndex;
	const { asset, blockAsset } = dbSchema;
	const links = yield* embeddable;

	const admitted = yield* admitAll(() =>
		links
			.links()
			.where(
				links.where(
					sql`${blockAsset.embeddingGeneration} is distinct from ${settings.embeddingGeneration}`,
				),
			)
			.limit(ADMISSION_BATCH),
	);

	const retitled = yield* admit({
		stage: "indexing",
		links: yield* links
			.links()
			.where(
				links.where(
					links.inActive,
					eq(blockAsset.indexStatus, "completed"),
					sql`${blockAsset.indexedTitle} is distinct from ${asset.title}`,
					gte(asset.updatedAt, sql`now() - ${RETITLE_WINDOW}`),
					lt(asset.updatedAt, sql`now() - ${RETITLE_QUIET}`),
					or(
						isNull(asset.metadataStatus),
						notInArray(asset.metadataStatus, [
							"pending",
							"active",
						]),
					),
				),
			)
			.orderBy(asset.updatedAt)
			.limit(RETITLE_BUDGET),
	});

	const { generation, rebuilding } = yield* rebuildState;
	if (generation !== undefined && !rebuilding) {
		// A generation started since keeps its flag.
		yield* db
			.update(settings)
			.set({
				embeddingRebuilding: false,
			})
			.where(
				and(
					eq(settings.embeddingRebuilding, true),
					eq(settings.embeddingGeneration, generation),
				),
			);
	}
	return admitted + retitled.length;
});

/**
 * Embeds every failed link of the active generation again whose failure
 * re-embedding can help, from its stored extraction, as a run of the
 * user's; links already embedded stay. Returns the links admitted.
 */
export const retryFailedEmbeddings = (userId: UserId) =>
	inActivityRun(
		{
			userId,
			kind: "retry",
			instance: true,
		},
		(runId) =>
			Effect.gen(function* () {
				const { blockAsset } = dbSchema;
				const links = yield* embeddable;
				return yield* admitAll(
					() =>
						links
							.links()
							.where(
								links.where(
									links.inActive,
									eq(blockAsset.indexStatus, "failed"),
									inArray(blockAsset.indexFailure, REEMBEDDABLE_FAILURES),
								),
							)
							.limit(ADMISSION_BATCH),
					{
						id: runId,
					},
				);
			}),
	);

/** The failed links of the active generation missing their stored extraction. Join `settings` too. */
const missingExtraction = Effect.gen(function* () {
	const { blockAsset } = dbSchema;
	const links = yield* embeddable;
	return (...conditions: ReturnType<typeof and>[]) =>
		links.where(
			links.inActive,
			eq(blockAsset.indexStatus, "failed"),
			eq(blockAsset.indexFailure, "missing_extraction"),
			...conditions,
		);
});

/** Every ready asset; under an index scoped to repositories, those linked in them. */
const readyAssets = Effect.gen(function* () {
	const db = yield* DB;
	const { blockIds } = yield* EmbeddingIndex;
	const { asset, blockAsset } = dbSchema;
	return (...conditions: ReturnType<typeof and>[]) =>
		and(
			eq(asset.processingStatus, "completed"),
			blockIds
				? exists(
						db
							.select({
								assetId: blockAsset.assetId,
							})
							.from(blockAsset)
							.where(
								and(
									eq(blockAsset.assetId, asset.id),
									inArray(blockAsset.blockId, [
										...blockIds,
									]),
								),
							),
					)
				: undefined,
			...conditions,
		);
});

/**
 * How many assets each scope prepares again: those a failed link of the
 * active generation misses the stored extraction of, and every ready one.
 */
const preparableAssets = Effect.gen(function* () {
	const db = yield* DB;
	const { settings } = yield* EmbeddingIndex;
	const { asset, blockAsset } = dbSchema;
	const missing = yield* missingExtraction;
	const ready = yield* readyAssets;
	const [missingRow] = yield* db
		.select({
			assets: sql<number>`count(distinct ${blockAsset.assetId})`.mapWith(
				Number,
			),
		})
		.from(blockAsset)
		.innerJoin(asset, eq(asset.id, blockAsset.assetId))
		.innerJoin(settings, sql`${settings.embeddingGeneration} is not null`)
		.where(missing());
	const [readyRow] = yield* db
		.select({
			assets: sql<number>`count(*)`.mapWith(Number),
		})
		.from(asset)
		.where(ready());
	return {
		missing: missingRow?.assets ?? 0,
		all: readyRow?.assets ?? 0,
	} satisfies Record<PrepareAgainScope, number>;
});

/** The job's run while its lease holds it. */
const heldRun = (payload: PrepareAssetsAgainPayload) =>
	leaseHeld(payload.leaseId).pipe(
		Effect.map((running): AdmissionRun | undefined =>
			running
				? {
						id: payload.runId,
					}
				: undefined,
		),
	);

/**
 * Admits every asset whose stored extraction a failed link of the active
 * generation is missing, a batch at a time, once per asset; its processing
 * indexes every link of the asset again when it completes. Returns the
 * assets queued.
 */
const prepareMissingAgain = (payload: PrepareAssetsAgainPayload) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const { settings } = yield* EmbeddingIndex;
		const { asset, blockAsset } = dbSchema;
		const missing = yield* missingExtraction;
		const assetsMissing = (...conditions: ReturnType<typeof and>[]) =>
			db
				.selectDistinct({
					id: asset.id,
					generation: asset.processingGeneration,
				})
				.from(blockAsset)
				.innerJoin(asset, eq(asset.id, blockAsset.assetId))
				.innerJoin(settings, sql`${settings.embeddingGeneration} is not null`)
				.where(missing(...conditions));
		// Checked again under the generation lock, so a switch since the batch was read queues nothing.
		const prepare = (
			selected: Effect.Success<ReturnType<typeof assetsMissing>>[number],
			run: AdmissionRun | undefined,
		) =>
			holdGeneration(
				Effect.gen(function* () {
					const [still] = yield* assetsMissing(eq(asset.id, selected.id));
					return still
						? yield* admit({
								stage: "processing",
								assets: [
									still,
								],
								from: [
									"completed",
								],
								run,
								allowOverBudget: true,
							})
						: [];
				}),
			).pipe(
				Effect.catchTag("EmbeddingsNotConfiguredError", () =>
					Effect.succeed<readonly StageTarget[]>([]),
				),
			);
		let queued = 0;
		while (true) {
			const run = yield* heldRun(payload);
			const assets = yield* assetsMissing().limit(ADMISSION_BATCH);
			if (assets.length === 0) return queued;
			const admitted = (yield* Effect.forEach(assets, (selected) =>
				prepare(selected, run),
			)).flat().length;
			queued += admitted;
			// Every asset went to another admission meanwhile; the next request looks again.
			if (admitted === 0) return queued;
		}
	});

/**
 * Admits every ready asset the run has not prepared yet, a batch at a time;
 * the run's members mark the ones it took on, so an asset it prepared counts
 * once however soon it is ready again. Admits nothing once the lease is
 * gone. Returns the assets queued.
 */
const prepareAllAgain = (payload: PrepareAssetsAgainPayload) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const { activityMember, asset } = dbSchema;
		const ready = yield* readyAssets;
		const notTakenOn = notExists(
			db
				.select({
					id: activityMember.id,
				})
				.from(activityMember)
				.where(
					and(
						eq(activityMember.runId, payload.runId),
						eq(activityMember.assetId, asset.id),
						isNotNull(activityMember.processingState),
					),
				),
		);
		let queued = 0;
		while (true) {
			const run = yield* heldRun(payload);
			if (!run) return queued;
			const assets = yield* db
				.select({
					id: asset.id,
					generation: asset.processingGeneration,
				})
				.from(asset)
				.where(ready(notTakenOn))
				.limit(ADMISSION_BATCH);
			if (assets.length === 0) return queued;
			const admitted = yield* admit({
				stage: "processing",
				assets,
				from: [
					"completed",
				],
				run,
				allowOverBudget: true,
			});
			queued += admitted.length;
			// Every asset went to another admission meanwhile; the next request looks again.
			if (admitted.length === 0) return queued;
		}
	});

/**
 * Prepares the assets of the job's scope again, as the job's run while its
 * lease holds it. An instance admin starts it, so the uploader's used-up
 * quota does not stop their model calls, which are still recorded against
 * them. An asset already being prepared is skipped. Releases the lease once
 * done. Returns the assets queued.
 */
export const prepareAssetsAgain = (payload: PrepareAssetsAgainPayload) =>
	Effect.gen(function* () {
		const queued =
			payload.scope === "all"
				? yield* prepareAllAgain(payload)
				: yield* prepareMissingAgain(payload);
		yield* releaseAdmission(payload.leaseId);
		return queued;
	});

/**
 * The instance's run preparing assets again whose work is not done: an
 * instance run that took on the processing of an asset; under an index
 * scoped to repositories, of an asset linked in them.
 */
const runningInstanceRun = Effect.gen(function* () {
	const db = yield* DB;
	const { blockIds } = yield* EmbeddingIndex;
	const { activityMember, activityRun, blockAsset } = dbSchema;
	const [run] = yield* db
		.select({
			id: activityRun.id,
		})
		.from(activityRun)
		.where(
			and(
				eq(activityRun.instance, true),
				runningRun,
				exists(
					db
						.select({
							id: activityMember.id,
						})
						.from(activityMember)
						.where(
							and(
								eq(activityMember.runId, activityRun.id),
								isNotNull(activityMember.processingState),
								blockIds
									? exists(
											db
												.select({
													assetId: blockAsset.assetId,
												})
												.from(blockAsset)
												.where(
													and(
														eq(blockAsset.assetId, activityMember.assetId),
														inArray(blockAsset.blockId, [
															...blockIds,
														]),
													),
												),
										)
									: undefined,
							),
						),
				),
			),
		)
		.orderBy(desc(activityRun.createdAt))
		.limit(1);
	return run?.id;
});

/**
 * Starts preparing again the assets of `scope`, as a run of the user's that
 * a job admits. A request joins the run of a job still queued or running,
 * else the instance's run whose work is not done, and queues a job for it
 * when no job of the scope waits and there are assets to prepare. Requests
 * take turns, so the queue never drops one. Returns how many assets there
 * are and the run.
 */
export const startPreparingAssetsAgain = (
	userId: UserId,
	scope: PrepareAgainScope,
) =>
	Effect.gen(function* () {
		const db = yield* DB;
		return yield* db.transaction(() =>
			Effect.gen(function* () {
				yield* db.execute(
					advisoryXactLock("instancePreparation", "assetsAgain"),
				);
				const assets = (yield* preparableAssets)[scope];
				const live = yield* liveJobs<PrepareAssetsAgainPayload>([
					PREPARE_ASSETS_AGAIN_JOB_NAME,
				]);
				const joined = live[0]?.data.runId ?? (yield* runningInstanceRun);
				const waiting = live.some(
					(job) => job.state !== "active" && job.data.scope === scope,
				);
				if (waiting || assets === 0) {
					return {
						assets,
						runId: joined ?? null,
						joined: joined !== undefined,
					};
				}

				const runId: ActivityRunId =
					joined ??
					(yield* db
						.insert(dbSchema.activityRun)
						.values({
							userId,
							kind: "retry",
							instance: true,
						})
						.returning({
							id: dbSchema.activityRun.id,
						}))[0].id;
				yield* sendJobBatchInTransaction<PrepareAssetsAgainPayload>({
					jobName: PREPARE_ASSETS_AGAIN_JOB_NAME,
					jobs: [
						{
							data: {
								runId,
								leaseId: yield* leaseRun(runId),
								scope,
							},
							options: {
								singletonKey: scope,
							},
						},
					],
				});
				return {
					assets,
					runId,
					joined: joined !== undefined,
				};
			}),
		);
	});

/** How far the active generation got in one organisation's repositories. */
export type OrganizationEmbeddingProgress = {
	/** Null for repositories without a home organisation. */
	readonly organizationId: OrganizationId | null;
	readonly name: string | null;
	readonly embedded: number;
	readonly waiting: number;
	readonly failed: number;
};

/**
 * Counts the active generation's links per organisation: embedded, failed,
 * and waiting for either. Failures come as counts per reason, never naming a
 * file or repository. Undefined before setup.
 */
export const embeddingProgress = Effect.gen(function* () {
	const db = yield* DB;
	const { settings } = yield* EmbeddingIndex;
	const { blockAsset, organization, resourceScope } = dbSchema;
	const links = yield* embeddable;
	const [active] = yield* db
		.select({
			generation: settings.embeddingGeneration,
		})
		.from(settings);
	if (active?.generation == null) return undefined;

	const failedInActive = and(
		links.inActive,
		eq(blockAsset.indexStatus, "failed"),
	);
	const count = (condition: ReturnType<typeof and>) =>
		sql<number>`count(*) filter (where ${condition})`.mapWith(Number);
	const organizations = yield* db
		.select({
			organizationId: organization.id,
			name: organization.name,
			total: sql<number>`count(*)`.mapWith(Number),
			embedded: count(
				and(links.inActive, eq(blockAsset.indexStatus, "completed")),
			),
			failed: count(failedInActive),
		})
		.from(blockAsset)
		.innerJoin(dbSchema.asset, eq(dbSchema.asset.id, blockAsset.assetId))
		.innerJoin(settings, sql`${settings.embeddingGeneration} is not null`)
		.leftJoin(resourceScope, homeScopeOf("block", blockAsset.blockId))
		.leftJoin(organization, eq(organization.id, resourceScope.organizationId))
		.where(links.counted())
		.groupBy(organization.id, organization.name)
		.orderBy(organization.name);
	const failures = yield* db
		.select({
			failure: blockAsset.indexFailure,
			count: sql<number>`count(*)`.mapWith(Number),
		})
		.from(blockAsset)
		.innerJoin(dbSchema.asset, eq(dbSchema.asset.id, blockAsset.assetId))
		.innerJoin(settings, sql`${settings.embeddingGeneration} is not null`)
		.where(links.where(failedInActive))
		.groupBy(blockAsset.indexFailure)
		.orderBy(blockAsset.indexFailure);

	const failureCounts = failures.map((row) => ({
		failure: (row.failure ?? "other") as PipelineFailure,
		count: row.count,
	}));
	return {
		generation: active.generation,
		rebuilding: yield* embeddingsRebuilding,
		organizations: organizations.map(
			({ total, ...row }): OrganizationEmbeddingProgress => ({
				...row,
				organizationId: row.organizationId as OrganizationId | null,
				waiting: total - row.embedded - row.failed,
			}),
		),
		failures: failureCounts,
		retryable: failureCounts
			.filter(({ failure }) => REEMBEDDABLE_FAILURES.includes(failure))
			.reduce((sum, { count }) => sum + count, 0),
		preparable: yield* preparableAssets,
	};
});
