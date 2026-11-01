import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { setTimeout as sleep } from "node:timers/promises";
import type { ActivityRunId, AssetId, BlockId, UserId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import {
	admitStage,
	type JobWithMetadata,
	PgBoss,
	PgBossService,
} from "@orcai/pg-boss";
import { QdrantLive } from "@orcai/qdrant";
import {
	type PipelineFailure,
	PROCESS_ASSET_DEAD_LETTER_JOB_NAME,
	PROCESS_ASSET_JOB_NAME,
	type ProcessAssetPayload,
	type VectorizeAssetPayload,
} from "@orcai/schema";
import { createUser, IntegrationLive } from "@orcai/testing";
import { and, eq, sql } from "drizzle-orm";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";
import {
	AssetPipelineError,
	indexingAttempt,
	markIndexingExhausted,
	markMetadataExhausted,
	markProcessingExhausted,
	processingAttempt,
	settleIndexingAttempt,
	settleProcessingAttempt,
} from "@/asset/pipeline-attempt";
import { ensureQueue } from "@/worker/run-worker-process";

const TIMEOUT = 30_000;

// Short supervise and monitor passes, so expired jobs are failed within seconds.
const boss = new PgBoss({
	host: process.env.POSTGRES_HOST,
	port: Number(process.env.POSTGRES_PORT),
	user: process.env.POSTGRES_USER,
	password: process.env.POSTGRES_PASSWORD,
	database: process.env.POSTGRES_DB,
	superviseIntervalSeconds: 1,
	monitorIntervalSeconds: 1,
});
boss.on("error", () => undefined);

const runtime = ManagedRuntime.make(
	Layer.mergeAll(
		IntegrationLive,
		QdrantLive,
		Layer.succeed(PgBossService, {
			boss,
		}),
	),
);

/** The file's own queues, each before its dead letter queue. */
const ownQueues: string[] = [];

beforeAll(() => boss.start(), TIMEOUT);
afterAll(async () => {
	for (const name of ownQueues) {
		await boss.offWork(name);
		await boss.deleteQueue(name);
	}
	await boss.stop({
		graceful: false,
		timeout: 1000,
	});
	await runtime.dispose();
}, TIMEOUT);

const run = <A, E>(
	effect: Effect.Effect<
		A,
		E,
		ManagedRuntime.ManagedRuntime.Services<typeof runtime>
	>,
) => runtime.runPromise(effect);

const until = async (condition: () => Promise<boolean>, what: string) => {
	const deadline = Date.now() + 20_000;
	while (!(await condition())) {
		if (Date.now() > deadline) throw new Error(`Timed out waiting for ${what}`);
		await sleep(100);
	}
};

const seedLink = () =>
	run(
		Effect.gen(function* () {
			const db = yield* DB;
			const user = yield* createUser();
			const [asset] = yield* db
				.insert(dbSchema.asset)
				.values({
					bucket: "uploads",
					prefix: `users/${user.id}/asset`,
					title: "Integration asset",
					size: 1,
					fileType: "pdf",
					userId: user.id,
				})
				.returning();
			const [block] = yield* db
				.insert(dbSchema.block)
				.values({
					type: "database",
					name: "Integration repository",
					config: {},
					userId: user.id,
				})
				.returning();
			const [link] = yield* db
				.insert(dbSchema.blockAsset)
				.values({
					blockId: block.id,
					assetId: asset.id,
				})
				.returning();
			return {
				asset,
				assetId: asset.id,
				blockId: block.id,
				attempt: link.indexAttempt,
			};
		}),
	);

const processingOf = (assetId: AssetId) =>
	run(
		Effect.gen(function* () {
			const [row] = yield* (yield* DB)
				.select({
					status: dbSchema.asset.processingStatus,
					failure: dbSchema.asset.processingFailure,
				})
				.from(dbSchema.asset)
				.where(eq(dbSchema.asset.id, assetId));
			return row;
		}),
	);

const indexingOf = (link: { assetId: AssetId; blockId: BlockId }) =>
	run(
		Effect.gen(function* () {
			const [row] = yield* (yield* DB)
				.select({
					status: dbSchema.blockAsset.indexStatus,
					failure: dbSchema.blockAsset.indexFailure,
				})
				.from(dbSchema.blockAsset)
				.where(
					and(
						eq(dbSchema.blockAsset.assetId, link.assetId),
						eq(dbSchema.blockAsset.blockId, link.blockId),
					),
				);
			return row;
		}),
	);

/**
 * A queue whose jobs run `attempt` and dead-letter into a queue handled by
 * `exhausted`, with the retry and expiry options of the test.
 */
const pipelineQueue = async <T extends object>(params: {
	attempt: (data: T) => Effect.Effect<void, unknown, DB>;
	exhausted: (
		jobs: JobWithMetadata<T>[],
	) => Effect.Effect<
		void,
		unknown,
		ManagedRuntime.ManagedRuntime.Services<typeof runtime>
	>;
	retryLimit: number;
	expireInSeconds?: number;
}) => {
	const name = `test-pipeline-${crypto.randomUUID()}`;
	const deadLetter = `${name}-dead-letter`;
	let attempts = 0;
	ownQueues.push(name, deadLetter);
	await boss.createQueue(deadLetter);
	await boss.createQueue(name, {
		retryLimit: params.retryLimit,
		retryDelay: 0,
		expireInSeconds: params.expireInSeconds ?? 60,
		deadLetter,
	});
	await boss.work<T>(
		name,
		{
			pollingIntervalSeconds: 0.5,
		},
		async ([job]) => {
			attempts += 1;
			await run(params.attempt(job.data));
		},
	);
	await boss.work(
		deadLetter,
		{
			pollingIntervalSeconds: 0.5,
			includeMetadata: true,
		},
		(jobs: JobWithMetadata<T>[]) => run(params.exhausted(jobs)),
	);
	return {
		send: (data: T) => boss.send(name, data),
		job: (id: string) => boss.getJobById(name, id),
		attempts: () => attempts,
	};
};

const failWith = (failure: PipelineFailure) =>
	Effect.fail(
		new AssetPipelineError({
			failure,
			cause: new Error(failure),
		}),
	);

const processPayload = (asset: {
	id: AssetId;
	prefix: string;
}): ProcessAssetPayload => ({
	assetRef: {
		bucket: "uploads",
		prefix: asset.prefix,
		id: asset.id,
		type: "pdf",
	},
});

describe("ensureQueue", () => {
	test(
		"gives an existing queue its dead letter queue",
		async () => {
			await boss.createQueue(PROCESS_ASSET_JOB_NAME);
			await boss.updateQueue(PROCESS_ASSET_JOB_NAME, {
				deadLetter: null,
			});
			await run(ensureQueue(PROCESS_ASSET_DEAD_LETTER_JOB_NAME));
			await run(
				ensureQueue(PROCESS_ASSET_JOB_NAME, {
					deadLetter: PROCESS_ASSET_DEAD_LETTER_JOB_NAME,
				}),
			);
			expect((await boss.getQueue(PROCESS_ASSET_JOB_NAME))?.deadLetter).toBe(
				PROCESS_ASSET_DEAD_LETTER_JOB_NAME,
			);
		},
		TIMEOUT,
	);
});

describe("processing failures", () => {
	test(
		"stay active while retries remain, then turn failed with the recorded kind",
		async () => {
			const { asset } = await seedLink();
			const queue = await pipelineQueue<ProcessAssetPayload>({
				attempt: (data) =>
					settleProcessingAttempt(
						processingAttempt(data),
						failWith("extraction"),
					),
				exhausted: markProcessingExhausted,
				retryLimit: 1,
			});

			await queue.send(processPayload(asset));
			await until(
				async () => (await processingOf(asset.id)).status === "failed",
				"the asset to fail",
			);

			expect(queue.attempts()).toBe(2);
			expect(await processingOf(asset.id)).toEqual({
				status: "failed",
				failure: "extraction",
			});
		},
		TIMEOUT,
	);

	test(
		"that expire dead-letter as timeout",
		async () => {
			const { asset } = await seedLink();
			const queue = await pipelineQueue<ProcessAssetPayload>({
				attempt: (data) =>
					settleProcessingAttempt(
						processingAttempt(data),
						Effect.sleep("5 seconds"),
					),
				exhausted: markProcessingExhausted,
				retryLimit: 1,
				expireInSeconds: 1,
			});

			await queue.send(processPayload(asset));
			await until(
				async () => (await processingOf(asset.id)).status === "failed",
				"the expired asset to fail",
			);

			expect(queue.attempts()).toBe(2);
			expect(await processingOf(asset.id)).toEqual({
				status: "failed",
				failure: "timeout",
			});
		},
		TIMEOUT,
	);

	test.each([
		"unsupported",
		"quota",
	] as const)(
		"%s fails at once and completes the job",
		async (failure) => {
			const { asset } = await seedLink();
			const queue = await pipelineQueue<ProcessAssetPayload>({
				attempt: (data) =>
					settleProcessingAttempt(processingAttempt(data), failWith(failure)),
				exhausted: markProcessingExhausted,
				retryLimit: 3,
			});

			const jobId = await queue.send(processPayload(asset));
			await until(
				async () => (await queue.job(jobId ?? ""))?.state === "completed",
				"the job to complete",
			);

			expect(queue.attempts()).toBe(1);
			expect(await processingOf(asset.id)).toEqual({
				status: "failed",
				failure,
			});
		},
		TIMEOUT,
	);
});

describe("indexing failures", () => {
	test(
		"turn the repository link failed once retries run out",
		async () => {
			const link = await seedLink();
			const queue = await pipelineQueue<VectorizeAssetPayload>({
				attempt: (data) =>
					settleIndexingAttempt(indexingAttempt(data), failWith("other")),
				exhausted: markIndexingExhausted,
				retryLimit: 1,
			});

			await queue.send({
				assetId: link.assetId,
				blockId: link.blockId,
				attempt: link.attempt,
			});
			await until(
				async () => (await indexingOf(link)).status === "failed",
				"the link to fail",
			);

			expect(queue.attempts()).toBe(2);
			expect(await indexingOf(link)).toEqual({
				status: "failed",
				failure: "other",
			});
		},
		TIMEOUT,
	);
});

/** A dead-lettered job as pg-boss hands it to the handler. */
const deadLetter = <T>(data: T, message = "extraction failed") =>
	({
		id: crypto.randomUUID(),
		data,
		sourceOutput: {
			message,
		},
	}) as JobWithMetadata<T>;

/** What Prepare again does: the next generation, pending, every link a new attempt. */
const processAgain = (assetId: AssetId) =>
	run(
		Effect.gen(function* () {
			const db = yield* DB;
			yield* db
				.update(dbSchema.asset)
				.set({
					processingStatus: "pending",
					processingFailure: null,
					processingGeneration: sql`${dbSchema.asset.processingGeneration} + 1`,
				})
				.where(eq(dbSchema.asset.id, assetId));
			yield* db
				.update(dbSchema.blockAsset)
				.set({
					indexStatus: "pending",
					indexFailure: null,
					indexAttempt: sql`nextval('block_asset_index_attempt_seq')`,
				})
				.where(eq(dbSchema.blockAsset.assetId, assetId));
		}),
	);

const metadataOf = (assetId: AssetId) =>
	run(
		Effect.gen(function* () {
			const [row] = yield* (yield* DB)
				.select({
					status: dbSchema.asset.metadataStatus,
					failure: dbSchema.asset.metadataFailure,
				})
				.from(dbSchema.asset)
				.where(eq(dbSchema.asset.id, assetId));
			return row;
		}),
	);

describe("replaced and finished attempts", () => {
	test(
		"a repeated dead letter keeps the first outcome, and one for a replaced attempt changes nothing",
		async () => {
			const link = await seedLink();
			const processing = deadLetter(processPayload(link.asset));
			const indexing = deadLetter({
				assetId: link.assetId,
				blockId: link.blockId,
				attempt: link.attempt,
			});

			await run(
				markProcessingExhausted([
					deadLetter(processing.data, "handler execution exceeded"),
				]),
			);
			await run(
				markIndexingExhausted([
					deadLetter(indexing.data, "handler execution exceeded"),
				]),
			);
			await run(
				markProcessingExhausted([
					processing,
				]),
			);
			await run(
				markIndexingExhausted([
					indexing,
				]),
			);
			expect(await processingOf(link.assetId)).toEqual({
				status: "failed",
				failure: "timeout",
			});
			expect(await indexingOf(link)).toEqual({
				status: "failed",
				failure: "timeout",
			});

			await processAgain(link.assetId);
			await run(
				markProcessingExhausted([
					processing,
				]),
			);
			await run(
				markIndexingExhausted([
					indexing,
				]),
			);
			expect(await processingOf(link.assetId)).toEqual({
				status: "pending",
				failure: null,
			});
			expect(await indexingOf(link)).toEqual({
				status: "pending",
				failure: null,
			});
		},
		TIMEOUT,
	);

	test(
		"an old delivery failing after a retry was admitted writes nothing and is not retried",
		async () => {
			const link = await seedLink();
			const old = {
				processing: processingAttempt(processPayload(link.asset)),
				indexing: indexingAttempt(link),
			};
			await processAgain(link.assetId);

			for (const failure of [
				"extraction",
				"unsupported",
			] as const) {
				await run(settleProcessingAttempt(old.processing, failWith(failure)));
				await run(settleIndexingAttempt(old.indexing, failWith(failure)));
			}

			expect(await processingOf(link.assetId)).toEqual({
				status: "pending",
				failure: null,
			});
			expect(await indexingOf(link)).toEqual({
				status: "pending",
				failure: null,
			});
		},
		TIMEOUT,
	);

	test(
		"a metadata dead letter for an earlier generation changes nothing",
		async () => {
			const { asset } = await seedLink();
			await run(
				Effect.gen(function* () {
					yield* (yield* DB)
						.update(dbSchema.asset)
						.set({
							metadataStatus: "pending",
							metadataGeneration: 2,
						})
						.where(eq(dbSchema.asset.id, asset.id));
				}),
			);
			const job = (generation: number) =>
				deadLetter({
					assetId: asset.id,
					userId: asset.userId,
					generation,
					mode: "apply" as const,
				});

			await run(
				markMetadataExhausted([
					job(1),
				]),
			);
			expect(await metadataOf(asset.id)).toEqual({
				status: "pending",
				failure: null,
			});

			await run(
				markMetadataExhausted([
					job(2),
				]),
			);
			await run(
				markMetadataExhausted([
					deadLetter(job(2).data, "handler execution exceeded"),
				]),
			);
			expect(await metadataOf(asset.id)).toEqual({
				status: "failed",
				failure: "other",
			});
		},
		TIMEOUT,
	);
});

/** A run of the asset's uploader that took on its processing, as an admission records it. */
const admitProcessing = (asset: { id: AssetId; userId: UserId }) =>
	run(
		Effect.gen(function* () {
			const db = yield* DB;
			const [created] = yield* db
				.insert(dbSchema.activityRun)
				.values({
					userId: asset.userId,
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
			return created.id;
		}),
	);

const processingMember = (runId: ActivityRunId) =>
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

const processingFailureId = (assetId: AssetId) =>
	run(
		Effect.gen(function* () {
			const [row] = yield* (yield* DB)
				.select({
					failureId: dbSchema.asset.processingFailureId,
				})
				.from(dbSchema.asset)
				.where(eq(dbSchema.asset.id, assetId));
			return row?.failureId;
		}),
	);

describe("activity runs", () => {
	test(
		"a dead letter fails its run's stage with the target's failure; a repeat changes nothing",
		async () => {
			const { asset } = await seedLink();
			const runId = await admitProcessing(asset);
			const job = deadLetter({
				...processPayload(asset),
				runId,
			});

			await run(
				markProcessingExhausted([
					job,
				]),
			);
			const failureId = await processingFailureId(asset.id);
			expect(failureId).toEqual(expect.any(String));
			expect(await processingMember(runId)).toEqual({
				state: "failed",
				failureId,
			});

			await run(
				markProcessingExhausted([
					job,
				]),
			);
			expect(await processingFailureId(asset.id)).toBe(failureId);
		},
		TIMEOUT,
	);

	test(
		"a newer run replaces the pending stage, so the older run's late failure settles nothing",
		async () => {
			const { asset } = await seedLink();
			const older = await admitProcessing(asset);
			await processAgain(asset.id);
			const newer = await admitProcessing(asset);

			await run(
				markProcessingExhausted([
					deadLetter({
						...processPayload(asset),
						runId: older,
					}),
				]),
			);
			expect(await processingMember(older)).toEqual({
				state: "replaced",
				failureId: null,
			});
			expect(await processingMember(newer)).toEqual({
				state: "pending",
				failureId: null,
			});
			expect(await processingOf(asset.id)).toMatchObject({
				status: "pending",
			});

			await run(
				markProcessingExhausted([
					deadLetter({
						...processPayload(asset),
						generation: 1,
						runId: newer,
					}),
				]),
			);
			expect(await processingMember(newer)).toMatchObject({
				state: "failed",
			});
		},
		TIMEOUT,
	);
});
