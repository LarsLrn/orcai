import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { setTimeout as sleep } from "node:timers/promises";
import type { AssetId, BlockId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { type JobWithMetadata, PgBoss, PgBossService } from "@orcai/pg-boss";
import {
	type PipelineFailure,
	PROCESS_ASSET_DEAD_LETTER_JOB_NAME,
	PROCESS_ASSET_JOB_NAME,
	type ProcessAssetPayload,
	type VectorizeAssetPayload,
} from "@orcai/schema";
import { createUser, IntegrationLive } from "@orcai/testing";
import { and, eq } from "drizzle-orm";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";
import {
	AssetPipelineError,
	markIndexingExhausted,
	markProcessingExhausted,
	settleIndexingAttempt,
	settleProcessingAttempt,
} from "@/asset/pipeline-failure";
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
		Layer.succeed(PgBossService, {
			boss,
		}),
	),
);

beforeAll(() => boss.start(), TIMEOUT);
afterAll(async () => {
	await boss.stop({
		graceful: false,
		timeout: 1000,
	});
	await runtime.dispose();
});

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
			yield* db.insert(dbSchema.blockAsset).values({
				blockId: block.id,
				assetId: asset.id,
			});
			return {
				asset,
				assetId: asset.id,
				blockId: block.id,
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
	exhausted: (jobs: JobWithMetadata<T>[]) => Effect.Effect<void, unknown, DB>;
	retryLimit: number;
	expireInSeconds?: number;
}) => {
	const name = `test-pipeline-${crypto.randomUUID()}`;
	const deadLetter = `${name}-dead-letter`;
	let attempts = 0;
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
					settleProcessingAttempt(data.assetRef.id, failWith("extraction")),
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
					settleProcessingAttempt(data.assetRef.id, Effect.sleep("5 seconds")),
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

	test(
		"that retrying cannot fix fail at once and complete the job",
		async () => {
			const { asset } = await seedLink();
			const queue = await pipelineQueue<ProcessAssetPayload>({
				attempt: (data) =>
					settleProcessingAttempt(data.assetRef.id, failWith("unsupported")),
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
				failure: "unsupported",
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
				attempt: (data) => settleIndexingAttempt(data, failWith("other")),
				exhausted: markIndexingExhausted,
				retryLimit: 1,
			});

			await queue.send({
				assetId: link.assetId,
				blockId: link.blockId,
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
