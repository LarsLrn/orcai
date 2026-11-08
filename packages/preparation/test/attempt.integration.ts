import { beforeAll, describe, expect, onTestFinished, test } from "bun:test";
import { setTimeout as sleep } from "node:timers/promises";
import { EncryptionKeyLive } from "@orcai/ai";
import type { ActivityRunId, AssetId, BlockId, UserId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import {
	defineWorker,
	type JobWithMetadata,
	type PgBoss,
	PgBossService,
	runWorkers,
	TestClock,
} from "@orcai/pg-boss";
import { IsolatedPgBossLive } from "@orcai/pg-boss/testing";
import {
	AssetPipelineError,
	admitStage,
	indexingAttempt,
	markIndexingExhausted,
	markMetadataExhausted,
	markProcessingExhausted,
	processingAttempt,
	settleIndexingAttempt,
	settleProcessingAttempt,
} from "@orcai/preparation";
import { QdrantLive } from "@orcai/qdrant";
import { IsolatedEmbeddingIndexLive } from "@orcai/qdrant/testing";
import { QuotaUnavailableError } from "@orcai/quota";
import {
	defaultRepositoryConfig,
	type JobQueue,
	type PipelineFailure,
	PROCESS_ASSET_DEAD_LETTER_JOB_NAME,
	PROCESS_ASSET_JOB_NAME,
	type ProcessAssetPayload,
	VECTORIZE_ASSET_DEAD_LETTER_JOB_NAME,
	VECTORIZE_ASSET_JOB_NAME,
	type VectorizeAssetPayload,
} from "@orcai/schema";
import { createUser, integrationRuntime } from "@orcai/testing";
import { and, eq, sql } from "drizzle-orm";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import type * as ManagedRuntime from "effect/ManagedRuntime";
import * as Scope from "effect/Scope";

const TIMEOUT = 30_000;

// pg-boss's time, so the queue table's retry delays and expiry pass at once.
const clock = new TestClock();

// Indexing never gets as far as Qdrant here, so the index stays without embeddings.
const runtime = integrationRuntime(
	IsolatedEmbeddingIndexLive().pipe(
		Layer.provideMerge(
			Layer.mergeAll(
				QdrantLive,
				EncryptionKeyLive,
				IsolatedPgBossLive({
					clock,
				}),
			),
		),
	),
);
const run = runtime.runPromise;

let boss: PgBoss;
beforeAll(async () => {
	boss = await run(PgBossService.useSync(({ boss }) => boss));
});

/**
 * Moves pg-boss's time on in steps of `stepMs` until `condition` holds. A
 * step shorter than the queue's expiry never expires a running attempt.
 */
const until = async (
	condition: () => Promise<boolean>,
	what: string,
	stepMs = 120_000,
) => {
	const deadline = Date.now() + 20_000;
	while (!(await condition())) {
		if (Date.now() > deadline) throw new Error(`Timed out waiting for ${what}`);
		await clock.setTime(clock.now() + stepMs);
		await clock.tick(1);
		await sleep(10);
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
					type: "repository",
					name: "Integration repository",
					config: defaultRepositoryConfig,
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
 * Works the stage's queue with `attempt` and its dead letter queue with
 * `exhausted` until the test ends, with the queue table's retries and expiry.
 */
const pipelineQueue = async <T extends object>(params: {
	queue: JobQueue;
	deadLetter: JobQueue;
	attempt: (data: T) => Effect.Effect<void, unknown, DB>;
	exhausted: (
		job: JobWithMetadata<T>,
	) => Effect.Effect<
		void,
		unknown,
		ManagedRuntime.ManagedRuntime.Services<typeof runtime>
	>;
}) => {
	let attempts = 0;
	const sent = new Set<string>();
	const scope = await run(Scope.make());
	onTestFinished(() => run(Scope.close(scope, Exit.void)));
	await run(
		runWorkers([
			defineWorker({
				queue: params.queue,
				concurrency: 1,
				pollingIntervalSeconds: 60,
				handler: (job: JobWithMetadata<T>) =>
					Effect.suspend(() => {
						if (sent.has(job.id)) attempts += 1;
						return params.attempt(job.data);
					}),
			}),
			defineWorker({
				queue: params.deadLetter,
				concurrency: 1,
				pollingIntervalSeconds: 60,
				handler: params.exhausted,
			}),
		]).pipe(Scope.provide(scope)),
	);
	return {
		send: async (data: T) => {
			const id = await boss.send(params.queue, data);
			if (id) sent.add(id);
			return id;
		},
		job: (id: string) => boss.getJobById(params.queue, id),
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
	processingGeneration: number;
}): ProcessAssetPayload => ({
	assetRef: {
		bucket: "uploads",
		prefix: asset.prefix,
		id: asset.id,
		type: "pdf",
	},
	generation: asset.processingGeneration,
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
				queue: PROCESS_ASSET_JOB_NAME,
				deadLetter: PROCESS_ASSET_DEAD_LETTER_JOB_NAME,
				exhausted: markProcessingExhausted,
			});

			await queue.send(processPayload(asset));
			await until(
				async () => (await processingOf(asset.id)).status === "failed",
				"the asset to fail",
			);

			expect(queue.attempts()).toBe(4);
			expect(await processingOf(asset.id)).toEqual({
				status: "failed",
				failure: "extraction",
			});
		},
		TIMEOUT,
	);

	test(
		"of a quota that cannot be read retry, unlike a refused one",
		async () => {
			const { asset } = await seedLink();
			const queue = await pipelineQueue<ProcessAssetPayload>({
				attempt: (data) =>
					settleProcessingAttempt(
						processingAttempt(data),
						Effect.fail(
							new QuotaUnavailableError({
								message: "The quota could not be read.",
								cause: new Error("connection refused"),
							}),
						),
					),
				queue: PROCESS_ASSET_JOB_NAME,
				deadLetter: PROCESS_ASSET_DEAD_LETTER_JOB_NAME,
				exhausted: markProcessingExhausted,
			});

			await queue.send(processPayload(asset));
			await until(
				async () => (await processingOf(asset.id)).status === "failed",
				"the asset to fail",
			);

			expect(queue.attempts()).toBe(4);
			expect(await processingOf(asset.id)).toEqual({
				status: "failed",
				failure: "other",
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
					settleProcessingAttempt(processingAttempt(data), Effect.never),
				queue: PROCESS_ASSET_JOB_NAME,
				deadLetter: PROCESS_ASSET_DEAD_LETTER_JOB_NAME,
				exhausted: markProcessingExhausted,
			});

			await queue.send(processPayload(asset));
			await until(
				async () => (await processingOf(asset.id)).status === "failed",
				"the expired asset to fail",
				3_700_000,
			);

			expect(queue.attempts()).toBe(4);
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
				queue: PROCESS_ASSET_JOB_NAME,
				deadLetter: PROCESS_ASSET_DEAD_LETTER_JOB_NAME,
				exhausted: markProcessingExhausted,
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
				queue: VECTORIZE_ASSET_JOB_NAME,
				deadLetter: VECTORIZE_ASSET_DEAD_LETTER_JOB_NAME,
				exhausted: markIndexingExhausted,
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

			expect(queue.attempts()).toBe(4);
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
				markProcessingExhausted(
					deadLetter(processing.data, "handler execution exceeded"),
				),
			);
			await run(
				markIndexingExhausted(
					deadLetter(indexing.data, "handler execution exceeded"),
				),
			);
			await run(markProcessingExhausted(processing));
			await run(markIndexingExhausted(indexing));
			expect(await processingOf(link.assetId)).toEqual({
				status: "failed",
				failure: "timeout",
			});
			expect(await indexingOf(link)).toEqual({
				status: "failed",
				failure: "timeout",
			});

			await processAgain(link.assetId);
			await run(markProcessingExhausted(processing));
			await run(markIndexingExhausted(indexing));
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

			await run(markMetadataExhausted(job(1)));
			expect(await metadataOf(asset.id)).toEqual({
				status: "pending",
				failure: null,
			});

			await run(markMetadataExhausted(job(2)));
			await run(
				markMetadataExhausted(
					deadLetter(job(2).data, "handler execution exceeded"),
				),
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
			return yield* db.transaction(() =>
				Effect.gen(function* () {
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

			await run(markProcessingExhausted(job));
			const failureId = await processingFailureId(asset.id);
			expect(failureId).toEqual(expect.any(String));
			expect(await processingMember(runId)).toEqual({
				state: "failed",
				failureId,
			});

			await run(markProcessingExhausted(job));
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
				markProcessingExhausted(
					deadLetter({
						...processPayload(asset),
						runId: older,
					}),
				),
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
				markProcessingExhausted(
					deadLetter({
						...processPayload(asset),
						generation: 1,
						runId: newer,
					}),
				),
			);
			expect(await processingMember(newer)).toMatchObject({
				state: "failed",
			});
		},
		TIMEOUT,
	);
});
