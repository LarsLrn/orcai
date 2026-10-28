import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test";
import { EncryptionKeyLive } from "@orcai/ai";
import { type AssetId, buckets } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { type Job, PgBoss, PgBossService } from "@orcai/pg-boss";
import {
	buildStoredExtractionKey,
	type StoredExtractionArtifact,
} from "@orcai/process";
import { getObjectAsJson, S3Live } from "@orcai/s3/server";
import {
	type ProcessAssetPayload,
	VECTORIZE_ASSET_JOB_NAME,
} from "@orcai/schema";
import { createUser, IntegrationLive } from "@orcai/testing";
import { and, eq, like, sql } from "drizzle-orm";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";
import { processAssetBatch } from "@/asset/jobs/process-asset-job";
import { requests, seedImageAsset, suggestion } from "@/asset/test-vision";

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
	await boss.createQueue(VECTORIZE_ASSET_JOB_NAME);
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

/** What the asset page's Reprocess does to the asset: the next generation, pending. */
const reprocess = (assetId: AssetId) =>
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

		await reprocess(asset.assetId);
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
						type: "database",
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
