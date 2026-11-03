import { beforeAll, describe, expect, onTestFinished, test } from "bun:test";
import { setTimeout as sleep } from "node:timers/promises";
import { EncryptionKeyLive } from "@orcai/ai";
import type { ActivityRunId, AssetId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import {
	admitStage,
	defineWorker,
	type JobWithMetadata,
	liveJobs,
	type PgBoss,
	PgBossService,
	runWorkers,
	TestClock,
} from "@orcai/pg-boss";
import { IsolatedPgBossLive } from "@orcai/pg-boss/testing";
import { activeGeneration, EmbeddingIndex, QdrantLive } from "@orcai/qdrant";
import { testEmbeddingIndex } from "@orcai/qdrant/testing";
import {
	PROCESS_ASSET_DEAD_LETTER_JOB_NAME,
	PROCESS_ASSET_JOB_NAME,
	type ProcessAssetPayload,
} from "@orcai/schema";
import { createUser, integrationRuntime } from "@orcai/testing";
import { eq } from "drizzle-orm";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Scope from "effect/Scope";
import {
	AssetPipelineError,
	processingAttempt,
	settleProcessingAttempt,
} from "@/asset/pipeline-attempt";
import {
	failStrandedStages,
	type StrandedStages,
	strandedStages,
} from "@/asset/preparation-sweep";

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
 * The sweep over the test's own assets: other files' stages keep their jobs
 * in schemas of their own, so they look stranded from here.
 */
const sweep = (...assetIds: AssetId[]) =>
	run(
		strandedStages.pipe(
			Effect.map(
				(stages): StrandedStages => ({
					processing: stages.processing.filter((stage) =>
						assetIds.includes(stage.assetId),
					),
					indexing: stages.indexing.filter((stage) =>
						assetIds.includes(stage.assetId),
					),
					metadata: stages.metadata.filter((stage) =>
						assetIds.includes(stage.assetId),
					),
				}),
			),
			Effect.flatMap(failStrandedStages),
		),
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
});
