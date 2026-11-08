import { beforeAll, describe, expect, onTestFinished, test } from "bun:test";
import { setTimeout as sleep } from "node:timers/promises";
import { EncryptionKeyLive } from "@orcai/ai";
import type { ActivityRunId, AssetId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import {
	defineWorker,
	type JobWithMetadata,
	liveJobs,
	type PgBoss,
	PgBossService,
	runWorkers,
	TestClock,
} from "@orcai/pg-boss";
import { IsolatedPgBossLive } from "@orcai/pg-boss/testing";
import {
	AssetPipelineError,
	admit,
	admitStage,
	completeProcessing,
	failStrandedStages,
	leaseRun,
	processingAttempt,
	releaseJobLeases,
	type StageAttempts,
	SWEEP_START,
	type SweepCursor,
	settleProcessingAttempt,
	strandedJobLeases,
	unfinishedStages,
	withoutLiveJobs,
} from "@orcai/preparation";
import { activeGeneration, EmbeddingIndex, QdrantLive } from "@orcai/qdrant";
import { testEmbeddingIndex } from "@orcai/qdrant/testing";
import {
	PREPARE_MISSING_EXTRACTIONS_AGAIN_JOB_NAME,
	PROCESS_ASSET_DEAD_LETTER_JOB_NAME,
	PROCESS_ASSET_JOB_NAME,
	type ProcessAssetPayload,
	VECTORIZE_ASSET_JOB_NAME,
	type VectorizeAssetPayload,
} from "@orcai/schema";
import { createUser, integrationRuntime } from "@orcai/testing";
import { eq, inArray } from "drizzle-orm";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Scope from "effect/Scope";

const TIMEOUT = 30_000;

const clock = new TestClock();

const runtime = integrationRuntime(
	Layer.mergeAll(
		QdrantLive,
		EncryptionKeyLive,
		IsolatedPgBossLive({
			clock,
		}),
		// Links count in the active generation only, so embeddings are set up.
		Layer.succeed(
			EmbeddingIndex,
			await testEmbeddingIndex({
				baseUrl: "http://127.0.0.1:9/v1",
				model: "integration",
				dimensions: 4,
			}),
		),
	),
);
const run = runtime.runPromise;

let boss: PgBoss;
beforeAll(async () => {
	boss = await run(PgBossService.useSync(({ boss }) => boss));
});

type Stage = "pending" | "active" | "completed";

/** An asset in a repository, its stages as given, and a run waiting on its processing. */
const seed = (stages: {
	processing: Stage;
	indexing?: Stage;
	/** The link's embedding generation; the active one when omitted. */
	embeddingGeneration?: number | null;
	metadata?: Stage;
}) =>
	run(
		Effect.gen(function* () {
			const db = yield* DB;
			const user = yield* createUser();
			const generation = yield* activeGeneration;
			const [asset] = yield* db
				.insert(dbSchema.asset)
				.values({
					bucket: "uploads",
					prefix: `users/${user.id}/asset`,
					title: "Sweep asset",
					size: 1,
					fileType: "pdf",
					userId: user.id,
					processingStatus: stages.processing,
					metadataStatus: stages.metadata ?? null,
				})
				.returning();
			const [block] = yield* db
				.insert(dbSchema.block)
				.values({
					type: "repository",
					name: "Sweep repository",
					config: {},
					userId: user.id,
				})
				.returning();
			yield* db.insert(dbSchema.blockAsset).values({
				blockId: block.id,
				assetId: asset.id,
				indexStatus: stages.indexing ?? "pending",
				embeddingGeneration:
					stages.embeddingGeneration === undefined
						? generation
						: stages.embeddingGeneration,
			});
			const [created] = yield* db
				.insert(dbSchema.activityRun)
				.values({
					userId: user.id,
					kind: "retry",
				})
				.returning({
					id: dbSchema.activityRun.id,
				});
			yield* admitStage(created.id, [
				{
					stage: "processing",
					assetId: asset.id,
				},
			]);
			return {
				asset,
				runId: created.id,
			};
		}),
	);

const stagesOf = (assetId: AssetId) =>
	run(
		Effect.gen(function* () {
			const db = yield* DB;
			const [row] = yield* db
				.select({
					processing: dbSchema.asset.processingStatus,
					processingFailure: dbSchema.asset.processingFailure,
					processingFailureId: dbSchema.asset.processingFailureId,
					metadata: dbSchema.asset.metadataStatus,
					metadataFailure: dbSchema.asset.metadataFailure,
					indexing: dbSchema.blockAsset.indexStatus,
					indexFailure: dbSchema.blockAsset.indexFailure,
				})
				.from(dbSchema.asset)
				.innerJoin(
					dbSchema.blockAsset,
					eq(dbSchema.blockAsset.assetId, dbSchema.asset.id),
				)
				.where(eq(dbSchema.asset.id, assetId));
			return row;
		}),
	);

const memberOf = (runId: ActivityRunId) =>
	run(
		Effect.gen(function* () {
			const [row] = yield* (yield* DB)
				.select({
					state: dbSchema.activityMember.processingState,
					failureId: dbSchema.activityMember.processingFailureId,
				})
				.from(dbSchema.activityMember)
				.where(eq(dbSchema.activityMember.runId, runId));
			return row;
		}),
	);

const processPayload = (
	asset: {
		id: AssetId;
		prefix: string;
	},
	runId: ActivityRunId,
): ProcessAssetPayload => ({
	assetRef: {
		bucket: "uploads",
		prefix: asset.prefix,
		id: asset.id,
		type: "pdf",
	},
	generation: 0,
	runId,
});

/** Whether a job for the asset still waits, retries or runs, dead-lettered or not. */
const hasLiveJob = async (assetId: AssetId) =>
	(
		await run(
			liveJobs<ProcessAssetPayload>([
				PROCESS_ASSET_JOB_NAME,
				PROCESS_ASSET_DEAD_LETTER_JOB_NAME,
			]),
		)
	).some((job) => job.data.assetRef.id === assetId);

/**
 * Moves pg-boss's time on in steps of `stepMs` until no job for the asset is
 * live. A step shorter than the queues' expiry never expires a running job.
 */
const exhaust = async (assetId: AssetId, stepMs: number) => {
	const deadline = Date.now() + 25_000;
	while (await hasLiveJob(assetId)) {
		if (Date.now() > deadline) throw new Error("The jobs never ran out");
		await clock.setTime(clock.now() + stepMs);
		await clock.tick(1);
		await sleep(10);
	}
};

/** Works processing with `attempt` and its dead letter queue with `exhausted` until the test ends. */
const work = async (
	attempt: (
		job: JobWithMetadata<ProcessAssetPayload>,
	) => Effect.Effect<void, unknown, DB>,
	exhausted: Effect.Effect<void, unknown>,
) => {
	const scope = await run(Scope.make());
	onTestFinished(() => run(Scope.close(scope, Exit.void)));
	await run(
		runWorkers([
			defineWorker({
				queue: PROCESS_ASSET_JOB_NAME,
				concurrency: 1,
				pollingIntervalSeconds: 60,
				handler: attempt,
			}),
			defineWorker({
				queue: PROCESS_ASSET_DEAD_LETTER_JOB_NAME,
				concurrency: 1,
				pollingIntervalSeconds: 60,
				handler: () => exhausted,
			}),
		]).pipe(Scope.provide(scope)),
	);
};

/**
 * The test's own unfinished stages, read batch by batch as the sweep reads
 * them, and with `stranded` only those each batch finds no live job for:
 * other files' stages keep their jobs in schemas of their own, so they look
 * stranded from here.
 */
const readStages = (
	assetIds: readonly AssetId[],
	options: {
		readonly stranded: boolean;
		readonly limit?: number;
	},
) =>
	run(
		Effect.gen(function* () {
			const ours = (stage: { assetId: AssetId }) =>
				assetIds.includes(stage.assetId);
			const found = {
				processing: [] as StageAttempts["processing"][number][],
				indexing: [] as StageAttempts["indexing"][number][],
				metadata: [] as StageAttempts["metadata"][number][],
			};
			let cursor: SweepCursor | undefined = SWEEP_START;
			while (cursor) {
				const batch: Effect.Success<ReturnType<typeof unfinishedStages>> =
					yield* unfinishedStages(cursor, options.limit);
				const kept = options.stranded ? yield* withoutLiveJobs(batch) : batch;
				found.processing.push(...kept.processing.filter(ours));
				found.indexing.push(...kept.indexing.filter(ours));
				found.metadata.push(...kept.metadata.filter(ours));
				cursor = batch.next;
			}
			return found satisfies StageAttempts;
		}),
	);

const strandedOf = (assetIds: readonly AssetId[], limit?: number) =>
	readStages(assetIds, {
		stranded: true,
		limit,
	});

/** The test's own unfinished stages as the sweep reads them, before it reads their jobs. */
const unfinishedOf = (...assetIds: AssetId[]) =>
	readStages(assetIds, {
		stranded: false,
	});

/** The sweep over the test's own assets. */
const sweep = async (...assetIds: AssetId[]) =>
	run(failStrandedStages(await strandedOf(assetIds)));

/** The asset's link, as the sweep reads it. */
const linkOf = (assetId: AssetId) =>
	run(
		Effect.gen(function* () {
			const [link] = yield* (yield* DB)
				.select({
					assetId: dbSchema.blockAsset.assetId,
					blockId: dbSchema.blockAsset.blockId,
					attempt: dbSchema.blockAsset.indexAttempt,
				})
				.from(dbSchema.blockAsset)
				.where(eq(dbSchema.blockAsset.assetId, assetId));
			return link;
		}),
	);

const unreachable = new Error("connect ECONNREFUSED 127.0.0.1:5432");

describe("a stage whose dead letter handler gave up", () => {
	test.each([
		{
			case: "a handler exception",
			attempt: (job: JobWithMetadata<ProcessAssetPayload>) =>
				settleProcessingAttempt(
					processingAttempt(job.data),
					Effect.fail(
						new AssetPipelineError({
							failure: "extraction",
							cause: new Error("extraction failed"),
						}),
					),
				),
			exhausted: Effect.die(new Error("dead letter handler bug")),
			failure: "extraction",
			stepMs: 120_000,
		},
		{
			case: "the database unavailable through exhaustion",
			attempt: () => Effect.fail(unreachable),
			exhausted: Effect.fail(unreachable),
			failure: "other",
			stepMs: 120_000,
		},
		{
			case: "workers that hang until their jobs expire",
			attempt: () => Effect.never,
			exhausted: Effect.never,
			failure: "other",
			stepMs: 3_700_000,
		},
	])(
		"after $case fails with its recorded kind, and its run's member with it",
		async ({ attempt, exhausted, failure, stepMs }) => {
			const { asset, runId } = await seed({
				processing: "pending",
			});
			await work(attempt, exhausted);

			await boss.send(PROCESS_ASSET_JOB_NAME, processPayload(asset, runId));
			await exhaust(asset.id, stepMs);
			expect([
				"pending",
				"active",
			]).toContain((await stagesOf(asset.id))?.processing);

			await sweep(asset.id);
			const stages = await stagesOf(asset.id);
			expect(stages).toMatchObject({
				processing: "failed",
				processingFailure: failure,
			});
			expect(await memberOf(runId)).toEqual({
				state: "failed",
				failureId: stages?.processingFailureId ?? null,
			});
		},
		TIMEOUT,
	);
});

describe("stages no job will deliver", () => {
	test(
		"fail processing, indexing and metadata alike, once",
		async () => {
			const processing = await seed({
				processing: "active",
			});
			const prepared = await seed({
				processing: "completed",
				indexing: "active",
				metadata: "pending",
			});

			await sweep(processing.asset.id, prepared.asset.id);
			expect(await stagesOf(processing.asset.id)).toMatchObject({
				processing: "failed",
				processingFailure: "other",
			});
			expect(await stagesOf(prepared.asset.id)).toMatchObject({
				indexing: "failed",
				indexFailure: "other",
				metadata: "failed",
				metadataFailure: "other",
			});

			const before = await stagesOf(processing.asset.id);
			await sweep(processing.asset.id, prepared.asset.id);
			expect(await stagesOf(processing.asset.id)).toEqual(before);
		},
		TIMEOUT,
	);

	test(
		"leave a stage whose job still waits to it",
		async () => {
			const { asset, runId } = await seed({
				processing: "pending",
			});
			await boss.send(PROCESS_ASSET_JOB_NAME, processPayload(asset, runId));

			await sweep(asset.id);
			expect(await stagesOf(asset.id)).toMatchObject({
				processing: "pending",
			});
			expect(await memberOf(runId)).toMatchObject({
				state: "pending",
			});
		},
		TIMEOUT,
	);

	test(
		"leave links that wait for processing or for the embedding setup",
		async () => {
			const processing = await seed({
				processing: "pending",
			});
			const unconfigured = await seed({
				processing: "completed",
				embeddingGeneration: null,
			});
			await boss.send(
				PROCESS_ASSET_JOB_NAME,
				processPayload(processing.asset, processing.runId),
			);

			await sweep(processing.asset.id, unconfigured.asset.id);
			expect(await stagesOf(processing.asset.id)).toMatchObject({
				processing: "pending",
				indexing: "pending",
			});
			expect(await stagesOf(unconfigured.asset.id)).toMatchObject({
				indexing: "pending",
			});
		},
		TIMEOUT,
	);

	test(
		"are the same read in small batches as in one",
		async () => {
			const stranded = await Promise.all([
				seed({
					processing: "active",
				}),
				seed({
					processing: "pending",
				}),
				seed({
					processing: "completed",
					indexing: "active",
					metadata: "pending",
				}),
				seed({
					processing: "completed",
					indexing: "pending",
				}),
			]);
			const waiting = await seed({
				processing: "pending",
			});
			await boss.send(
				PROCESS_ASSET_JOB_NAME,
				processPayload(waiting.asset, waiting.runId),
			);
			const ids = [
				...stranded,
				waiting,
			].map(({ asset }) => asset.id);
			const sorted = (stages: StageAttempts) => ({
				processing: stages.processing.map((stage) => stage.assetId).sort(),
				indexing: stages.indexing.map((stage) => stage.assetId).sort(),
				metadata: stages.metadata.map((stage) => stage.assetId).sort(),
			});

			const whole = sorted(await strandedOf(ids));
			expect(whole).toEqual({
				processing: [
					stranded[0].asset.id,
					stranded[1].asset.id,
				].sort(),
				indexing: [
					stranded[2].asset.id,
					stranded[3].asset.id,
				].sort(),
				metadata: [
					stranded[2].asset.id,
				],
			});
			expect(sorted(await strandedOf(ids, 2))).toEqual(whole);
		},
		TIMEOUT,
	);

	test(
		"leave each link of one asset across batches to its own job",
		async () => {
			const { asset } = await seed({
				processing: "completed",
				indexing: "active",
			});
			const links = await run(
				Effect.gen(function* () {
					const db = yield* DB;
					const generation = yield* activeGeneration;
					const blocks = yield* db
						.insert(dbSchema.block)
						.values(
							[
								1,
								2,
								3,
							].map(() => ({
								type: "repository" as const,
								name: "Sweep repository",
								config: {},
								userId: asset.userId,
							})),
						)
						.returning({
							id: dbSchema.block.id,
						});
					yield* db.insert(dbSchema.blockAsset).values(
						blocks.map((block) => ({
							blockId: block.id,
							assetId: asset.id,
							indexStatus: "active" as const,
							embeddingGeneration: generation,
						})),
					);
					return yield* db
						.select({
							assetId: dbSchema.blockAsset.assetId,
							blockId: dbSchema.blockAsset.blockId,
							attempt: dbSchema.blockAsset.indexAttempt,
						})
						.from(dbSchema.blockAsset)
						.where(eq(dbSchema.blockAsset.assetId, asset.id))
						.orderBy(dbSchema.blockAsset.blockId);
				}),
			);
			const [waiting, stranded] = [
				links.filter((_, index) => index % 2 === 0),
				links.filter((_, index) => index % 2 === 1),
			];
			await boss.insert(
				VECTORIZE_ASSET_JOB_NAME,
				waiting.map((link) => ({
					data: link satisfies VectorizeAssetPayload,
				})),
			);

			const found = await strandedOf(
				[
					asset.id,
				],
				1,
			);
			expect(found.indexing.map((link) => link.blockId).sort()).toEqual(
				stranded.map((link) => link.blockId).sort(),
			);
		},
		TIMEOUT,
	);

	test(
		"release the run lease of a preparation job that is gone and keep one whose job waits",
		async () => {
			const { gone, waiting } = await run(
				Effect.gen(function* () {
					const db = yield* DB;
					const user = yield* createUser();
					const lease = () =>
						Effect.gen(function* () {
							const [created] = yield* db
								.insert(dbSchema.activityRun)
								.values({
									userId: user.id,
									kind: "retry",
								})
								.returning({
									id: dbSchema.activityRun.id,
								});
							return {
								runId: created.id,
								leaseId: yield* leaseRun(created.id),
							};
						});
					return {
						gone: yield* lease(),
						waiting: yield* lease(),
					};
				}),
			);
			const job = await boss.send(
				PREPARE_MISSING_EXTRACTIONS_AGAIN_JOB_NAME,
				waiting,
			);
			onTestFinished(async () => {
				if (job) {
					await boss.deleteJob(PREPARE_MISSING_EXTRACTIONS_AGAIN_JOB_NAME, job);
				}
			});
			const ours = new Set([
				gone.leaseId,
				waiting.leaseId,
			]);

			const stranded = (await run(strandedJobLeases)).filter((id) =>
				ours.has(id),
			);
			expect(stranded).toEqual([
				gone.leaseId,
			]);
			await run(releaseJobLeases(stranded));

			const leases = await run(
				Effect.gen(function* () {
					return (yield* (yield* DB)
						.select({
							id: dbSchema.activityAdmission.id,
						})
						.from(dbSchema.activityAdmission)
						.where(
							inArray(dbSchema.activityAdmission.id, [
								...ours,
							]),
						)).map((row) => row.id);
				}),
			);
			expect(leases).toEqual([
				waiting.leaseId,
			]);
		},
		TIMEOUT,
	);
});

describe("a stage that changes between the sweep's stage and job reads", () => {
	test(
		"stays completed when its delivery completes it and its job in between",
		async () => {
			const { asset, runId } = await seed({
				processing: "pending",
			});
			const jobId = await boss.send(
				PROCESS_ASSET_JOB_NAME,
				processPayload(asset, runId),
			);
			const read = await unfinishedOf(asset.id);
			expect(read.processing).toHaveLength(1);

			expect(
				await run(
					completeProcessing({
						assetId: asset.id,
						generation: 0,
						runId,
					}),
				),
			).toBe(true);
			if (jobId) {
				await boss.complete(PROCESS_ASSET_JOB_NAME, jobId, null, {
					includeQueued: true,
				});
			}
			const stranded = await run(withoutLiveJobs(read));
			expect(stranded.processing).toHaveLength(1);

			expect(await run(failStrandedStages(stranded))).toBe(0);
			expect(await stagesOf(asset.id)).toMatchObject({
				processing: "completed",
				processingFailure: null,
			});
			expect(await memberOf(runId)).toMatchObject({
				state: "completed",
			});
		},
		TIMEOUT,
	);

	test(
		"keeps the attempt admitted in between",
		async () => {
			const { asset } = await seed({
				processing: "completed",
				indexing: "active",
			});
			const read = await unfinishedOf(asset.id);
			expect(read.indexing).toHaveLength(1);

			const link = await linkOf(asset.id);
			await run(
				admit({
					stage: "indexing",
					links: [
						link,
					],
				}),
			);
			const stranded = await run(withoutLiveJobs(read));
			expect(stranded.indexing).toHaveLength(1);

			expect(await run(failStrandedStages(stranded))).toBe(0);
			expect(await stagesOf(asset.id)).toMatchObject({
				indexing: "pending",
				indexFailure: null,
			});
			const admitted = await linkOf(asset.id);
			expect(admitted.attempt).not.toBe(link.attempt);
			expect(
				(await run(withoutLiveJobs(await unfinishedOf(asset.id)))).indexing,
			).toEqual([]);
		},
		TIMEOUT,
	);

	test(
		"is left to a job sent for its attempt in between",
		async () => {
			const { asset, runId } = await seed({
				processing: "pending",
			});
			const read = await unfinishedOf(asset.id);
			expect(read.processing).toHaveLength(1);

			await boss.send(PROCESS_ASSET_JOB_NAME, processPayload(asset, runId));
			expect((await run(withoutLiveJobs(read))).processing).toEqual([]);
		},
		TIMEOUT,
	);
});

describe("a stage the sweep reads", () => {
	test(
		"is never failed while deliveries complete during sweeps",
		async () => {
			const seeded = await Promise.all(
				Array.from(
					{
						length: 12,
					},
					() =>
						seed({
							processing: "pending",
						}),
				),
			);
			await Promise.all(
				seeded.map(({ asset, runId }) =>
					boss.send(PROCESS_ASSET_JOB_NAME, processPayload(asset, runId)),
				),
			);
			const ids = seeded.map(({ asset }) => asset.id);

			let delivering = true;
			const deliveries = (async () => {
				try {
					for (;;) {
						const [job] = await boss.fetch<ProcessAssetPayload>(
							PROCESS_ASSET_JOB_NAME,
						);
						if (!job) return;
						await run(completeProcessing(processingAttempt(job.data)));
						await boss.complete(PROCESS_ASSET_JOB_NAME, job.id);
					}
				} finally {
					delivering = false;
				}
			})();
			let sweeps = 0;
			while (delivering || sweeps === 0) {
				await sweep(...ids);
				sweeps++;
			}
			await deliveries;
			await sweep(...ids);

			for (const id of ids) {
				expect(await stagesOf(id)).toMatchObject({
					processing: "completed",
					indexing: "pending",
					indexFailure: null,
				});
			}
		},
		TIMEOUT,
	);
});
