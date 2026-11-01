import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test";
import { setTimeout as sleep } from "node:timers/promises";
import { EncryptionKeyLive } from "@orcai/ai";
import { type AssetId, buckets } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import {
	admitStage,
	type Job,
	type JobWithMetadata,
	PgBoss,
	PgBossService,
	queueProcessing,
} from "@orcai/pg-boss";
import {
	buildStoredExtractionKey,
	type StoredExtractionArtifact,
} from "@orcai/process";
import { getObjectAsJson, S3Live } from "@orcai/s3/server";
import {
	GENERATE_ASSET_METADATA_JOB_NAME,
	type ProcessAssetPayload,
	VECTORIZE_ASSET_JOB_NAME,
	type VectorizeAssetPayload,
} from "@orcai/schema";
import { createJobQueues, createUser, IntegrationLive } from "@orcai/testing";
import { and, eq, like, sql } from "drizzle-orm";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";
import { processAssetBatch } from "@/asset/jobs/process-asset-job";
import { markProcessingExhausted } from "@/asset/pipeline-attempt";
import {
	held,
	requests,
	seedImageAsset,
	suggestion,
} from "@/asset/test-vision";

const TIMEOUT = 30_000;

const boss = new PgBoss({
	host: process.env.POSTGRES_HOST,
	port: Number(process.env.POSTGRES_PORT),
	user: process.env.POSTGRES_USER,
	password: process.env.POSTGRES_PASSWORD,
	database: process.env.POSTGRES_DB,
});
boss.on("error", () => undefined);

/** Makes the next job insert fail, as a crash right before it would. */
let failNextInsert = false;
const flakyBoss = new Proxy(boss, {
	get: (target, property, receiver) =>
		property === "insert"
			? (...args: Parameters<PgBoss["insert"]>) => {
					if (failNextInsert) {
						failNextInsert = false;
						return Promise.reject(new Error("connection lost"));
					}
					return target.insert(...args);
				}
			: Reflect.get(target, property, receiver),
});

const runtime = ManagedRuntime.make(
	Layer.mergeAll(
		IntegrationLive,
		S3Live,
		EncryptionKeyLive,
		Layer.succeed(PgBossService, {
			boss: flakyBoss,
		}),
	),
);

beforeAll(async () => {
	await boss.start();
	await createJobQueues(boss);
}, TIMEOUT);
afterAll(async () => {
	await boss.stop({
		graceful: false,
		timeout: 1000,
	});
	await runtime.dispose();
});

beforeEach(() => {
	requests.length = 0;
});

const run = <A, E>(
	effect: Effect.Effect<
		A,
		E,
		ManagedRuntime.ManagedRuntime.Services<typeof runtime>
	>,
) => runtime.runPromise(effect);

/** A delivery of the processing job, as pg-boss hands it to the handler. */
const delivery = (
	asset: {
		assetId: AssetId;
		prefix: string;
	},
	generation: number,
) =>
	({
		id: crypto.randomUUID(),
		name: "process-asset",
		data: {
			assetRef: {
				bucket: buckets.processed.name,
				prefix: asset.prefix,
				id: asset.assetId,
				type: "png",
			},
			generation,
		},
	}) as Job<ProcessAssetPayload>;

const processOnce = (job: Job<ProcessAssetPayload>) =>
	run(
		processAssetBatch([
			job,
		]),
	);

const statusOf = (assetId: AssetId) =>
	run(
		Effect.gen(function* () {
			const [row] = yield* (yield* DB)
				.select({
					status: dbSchema.asset.processingStatus,
				})
				.from(dbSchema.asset)
				.where(eq(dbSchema.asset.id, assetId));
			return row?.status;
		}),
	);

const chargedCalls = (assetId: AssetId) =>
	run(
		Effect.gen(function* () {
			const rows = yield* (yield* DB)
				.select({
					id: dbSchema.quotaUsageEvent.id,
				})
				.from(dbSchema.quotaUsageEvent)
				.where(
					and(
						like(dbSchema.quotaUsageEvent.appRequestId, `image:${assetId}:%`),
						eq(dbSchema.quotaUsageEvent.eventType, "finalized"),
					),
				);
			return rows.length;
		}),
	);

/** What the asset page's Prepare again does to the asset: the next generation, pending. */
const prepareAgain = (assetId: AssetId) =>
	run(
		Effect.gen(function* () {
			yield* (yield* DB)
				.update(dbSchema.asset)
				.set({
					processingStatus: "pending",
					processingGeneration: sql`${dbSchema.asset.processingGeneration} + 1`,
				})
				.where(eq(dbSchema.asset.id, assetId));
		}),
	);

test(
	"a replayed or superseded delivery describes nothing; each generation is described once",
	async () => {
		const asset = await run(
			seedImageAsset({
				capabilities: [
					"text",
					"image",
				],
			}),
		);
		const first = delivery(asset, 0);

		await processOnce(first);
		expect(await statusOf(asset.assetId)).toBe("completed");
		expect(await chargedCalls(asset.assetId)).toBe(1);

		// pg-boss delivers it again when its completion was not acknowledged.
		await processOnce(first);
		expect(await statusOf(asset.assetId)).toBe("completed");
		const extraction = await run(
			getObjectAsJson<StoredExtractionArtifact>({
				bucket: buckets.processed.name,
				name: buildStoredExtractionKey(asset.assetId),
			}),
		);
		expect(extraction.images[0]?.text).toBe(suggestion.text);

		await prepareAgain(asset.assetId);
		await processOnce(first);
		expect(await statusOf(asset.assetId)).toBe("pending");

		await processOnce(delivery(asset, 1));
		expect(await statusOf(asset.assetId)).toBe("completed");
		expect(await chargedCalls(asset.assetId)).toBe(2);
		expect(requests).toHaveLength(2);
	},
	TIMEOUT,
);

test(
	"a crash while queuing indexing leaves the asset to the retry, which completes it and queues indexing",
	async () => {
		const asset = await run(
			seedImageAsset({
				capabilities: [
					"text",
					"image",
				],
			}),
		);
		const blockId = await run(
			Effect.gen(function* () {
				const db = yield* DB;
				const user = yield* createUser();
				const [block] = yield* db
					.insert(dbSchema.block)
					.values({
						type: "repository",
						name: "Crash repository",
						config: {},
						userId: user.id,
					})
					.returning();
				yield* db.insert(dbSchema.blockAsset).values({
					blockId: block.id,
					assetId: asset.assetId,
				});
				return block.id;
			}),
		);
		const job = delivery(asset, 0);
		const indexingQueued = async () =>
			(
				await boss.findJobs(VECTORIZE_ASSET_JOB_NAME, {
					data: {
						assetId: asset.assetId,
						blockId,
					},
				})
			).length;

		failNextInsert = true;
		await expect(processOnce(job)).rejects.toBeDefined();
		expect(await statusOf(asset.assetId)).toBe("active");
		expect(await indexingQueued()).toBe(0);

		await processOnce(job);
		expect(await statusOf(asset.assetId)).toBe("completed");
		expect(await indexingQueued()).toBe(1);
	},
	TIMEOUT,
);

/** An image asset linked to a fresh repository, with what its completion queued. */
const seedLinked = async () => {
	const asset = await run(
		seedImageAsset({
			capabilities: [
				"text",
				"image",
			],
		}),
	);
	const blockId = await run(
		Effect.gen(function* () {
			const db = yield* DB;
			const user = yield* createUser();
			const [block] = yield* db
				.insert(dbSchema.block)
				.values({
					type: "repository",
					name: "Fenced repository",
					config: {},
					userId: user.id,
				})
				.returning();
			yield* db.insert(dbSchema.blockAsset).values({
				blockId: block.id,
				assetId: asset.assetId,
			});
			return block.id;
		}),
	);
	const queued = async () => ({
		indexing: (
			await boss.findJobs(VECTORIZE_ASSET_JOB_NAME, {
				data: {
					assetId: asset.assetId,
					blockId,
				},
			})
		).length,
		metadata: (
			await boss.findJobs(GENERATE_ASSET_METADATA_JOB_NAME, {
				data: {
					assetId: asset.assetId,
				},
			})
		).length,
	});
	return {
		asset,
		blockId,
		queued,
	};
};

/** Holds the vision endpoint until the returned release is called, once `count` requests wait. */
const holdVision = async (count: number, start: () => Promise<unknown>[]) => {
	const release = Promise.withResolvers<void>();
	held.until = release.promise;
	const running = start();
	while (requests.length < count) {
		await sleep(25);
	}
	return {
		release: async () => {
			release.resolve();
			held.until = undefined;
			await Promise.all(running);
		},
	};
};

test(
	"two deliveries of one generation at once complete it once and queue its follow-ups once",
	async () => {
		const { asset, queued } = await seedLinked();
		const job = delivery(asset, 0);

		const both = await holdVision(2, () => [
			processOnce(job),
			processOnce(job),
		]);
		await both.release();

		expect(await statusOf(asset.assetId)).toBe("completed");
		expect(await queued()).toEqual({
			indexing: 1,
			metadata: 1,
		});
	},
	TIMEOUT,
);

test(
	"a delivery replaced while it ran completes nothing and queues nothing",
	async () => {
		const { asset, queued } = await seedLinked();

		const late = await holdVision(1, () => [
			processOnce(delivery(asset, 0)),
		]);
		// Its job expired meanwhile, ran out of retries and was processed again.
		await run(
			markProcessingExhausted([
				{
					...delivery(asset, 0),
					sourceOutput: {
						message: "handler execution exceeded",
					},
				} as JobWithMetadata<ProcessAssetPayload>,
			]),
		);
		await run(
			queueProcessing(
				{
					id: asset.assetId,
					bucket: buckets.processed.name,
					prefix: asset.prefix,
					fileType: "png",
					processingGeneration: 0,
				},
				[
					"failed",
				],
			),
		);
		await late.release();

		expect(await statusOf(asset.assetId)).toBe("pending");
		expect(await queued()).toEqual({
			indexing: 0,
			metadata: 0,
		});
	},
	TIMEOUT,
);

test(
	"completion carries the run on to metadata and to indexing in its member's repository only",
	async () => {
		const { asset, blockId } = await seedLinked();
		const { elsewhere, runId } = await run(
			Effect.gen(function* () {
				const db = yield* DB;
				const [other] = yield* db
					.insert(dbSchema.block)
					.values({
						type: "repository",
						name: "Other repository",
						config: {},
						userId: asset.uploaderId,
					})
					.returning();
				yield* db.insert(dbSchema.blockAsset).values({
					blockId: other.id,
					assetId: asset.assetId,
				});
				const [created] = yield* db
					.insert(dbSchema.activityRun)
					.values({
						userId: asset.uploaderId,
						kind: "upload",
						blockId,
					})
					.returning();
				yield* admitStage(created.id, [
					{
						stage: "processing",
						assetId: asset.assetId,
						blockId,
					},
				]);
				return {
					elsewhere: other.id,
					runId: created.id,
				};
			}),
		);
		const job = delivery(asset, 0);

		await processOnce({
			...job,
			data: {
				...job.data,
				runId,
			},
		});

		const indexingRuns = async (target: typeof blockId) =>
			(
				await boss.findJobs<VectorizeAssetPayload>(VECTORIZE_ASSET_JOB_NAME, {
					data: {
						assetId: asset.assetId,
						blockId: target,
					},
				})
			).map((found) => found.data.runId);
		expect(await indexingRuns(blockId)).toEqual([
			runId,
		]);
		expect(await indexingRuns(elsewhere)).toEqual([
			undefined,
		]);
		const { member, actors } = await run(
			Effect.gen(function* () {
				const db = yield* DB;
				const [member] = yield* db
					.select({
						processing: dbSchema.activityMember.processingState,
						metadata: dbSchema.activityMember.metadataState,
						indexing: dbSchema.activityMember.indexingState,
					})
					.from(dbSchema.activityMember)
					.where(eq(dbSchema.activityMember.runId, runId));
				const actors = yield* db
					.select({
						blockId: dbSchema.blockAsset.blockId,
						actor: dbSchema.blockAsset.indexActorId,
					})
					.from(dbSchema.blockAsset)
					.where(eq(dbSchema.blockAsset.assetId, asset.assetId));
				return {
					member,
					actors: Object.fromEntries(
						actors.map((row) => [
							row.blockId,
							row.actor,
						]),
					),
				};
			}),
		);
		expect(member).toEqual({
			processing: "completed",
			metadata: "pending",
			indexing: "pending",
		});
		expect(actors).toEqual({
			[blockId]: asset.uploaderId,
			[elsewhere]: null,
		});
	},
	TIMEOUT,
);
