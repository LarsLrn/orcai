import { beforeAll, beforeEach, expect, test } from "bun:test";
import { setTimeout as sleep } from "node:timers/promises";
import { EncryptionKeyLive } from "@orcai/ai";
import { type AssetId, buckets } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import {
	type Job,
	type JobWithMetadata,
	type PgBoss,
	PgBossService,
} from "@orcai/pg-boss";
import { IsolatedPgBossLive } from "@orcai/pg-boss/testing";
import {
	admit,
	admitStage,
	claimProcessing,
	cleanUpDeletions,
	markProcessingExhausted,
	recordDeletion,
	writeWhileProcessing,
} from "@orcai/preparation";
import { readStoredExtraction } from "@orcai/process";
import { EmbeddingIndex, QdrantLive } from "@orcai/qdrant";
import { testEmbeddingIndex } from "@orcai/qdrant/testing";
import { QuotaReservationsLive } from "@orcai/quota";
import { processedAssetPrefix } from "@orcai/s3";
import {
	isS3NotFound,
	S3Live,
	S3Service,
	sendHeadObjectCommand,
	sendPutObjectCommand,
} from "@orcai/s3/server";
import {
	defaultRepositoryConfig,
	GENERATE_ASSET_METADATA_JOB_NAME,
	PROCESS_ASSET_JOB_NAME,
	type ProcessAssetPayload,
	VECTORIZE_ASSET_JOB_NAME,
	type VectorizeAssetPayload,
} from "@orcai/schema";
import {
	awaitLockWaiters,
	createUser,
	integrationRuntime,
	rejection,
} from "@orcai/testing";
import { and, eq, like, sql } from "drizzle-orm";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import { processAsset } from "@/asset/jobs/process-asset-job";
import { pdfWithPages } from "@/asset/test-document";
import {
	held,
	requests,
	seedVisionAsset,
	suggestion,
} from "@/asset/test-vision";

const TIMEOUT = 30_000;

/** Makes the next job insert fail, as a crash right before it would. */
let failNextInsert = false;
const flaky = (boss: PgBoss) =>
	new Proxy(boss, {
		get: (target, property) => {
			if (property === "insert")
				return (...args: Parameters<PgBoss["insert"]>) => {
					if (failNextInsert) {
						failNextInsert = false;
						return Promise.reject(new Error("connection lost"));
					}
					return target.insert(...args);
				};
			const value = Reflect.get(target, property);
			return typeof value === "function" ? value.bind(target) : value;
		},
	});

const runtime = integrationRuntime(
	Layer.mergeAll(
		S3Live,
		QuotaReservationsLive,
		EncryptionKeyLive,
		QdrantLive,
		// Completion queues indexing once embeddings are set up; nothing embeds here.
		Layer.succeed(
			EmbeddingIndex,
			await testEmbeddingIndex({
				baseUrl: "http://127.0.0.1:9/v1",
				model: "integration",
				dimensions: 4,
			}),
		),
		Layer.effect(
			PgBossService,
			PgBossService.useSync((service) => ({
				...service,
				boss: flaky(service.boss),
			})),
		).pipe(Layer.provide(IsolatedPgBossLive())),
	),
);
const run = runtime.runPromise;

let boss: PgBoss;
beforeAll(async () => {
	boss = await run(PgBossService.useSync(({ boss }) => boss));
});

beforeEach(() => {
	requests.length = 0;
});

/** A delivery of the processing job, as pg-boss hands it to the handler. */
const delivery = (
	asset: {
		assetId: AssetId;
		prefix: string;
		fileType?: "png" | "pdf" | "pptx";
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
				type: asset.fileType ?? "png",
			},
			generation,
		},
	}) as Job<ProcessAssetPayload>;

const processOnce = (job: Job<ProcessAssetPayload>) => run(processAsset(job));

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
	"over the uploader's quota an upload fails with quota, and an instance admin's run prepares it again, charged to the uploader",
	async () => {
		const asset = await run(
			seedVisionAsset({
				capabilities: [
					"text",
					"image",
				],
				budget: 1,
			}),
		);

		await processOnce(delivery(asset, 0));
		expect(await statusOf(asset.assetId)).toBe("failed");
		expect(requests).toHaveLength(0);

		await run(
			admit({
				stage: "processing",
				assets: [
					{
						id: asset.assetId,
						generation: 0,
					},
				],
				from: [
					"failed",
				],
				allowOverBudget: true,
			}),
		);
		const [job] = (
			await boss.findJobs<ProcessAssetPayload>(PROCESS_ASSET_JOB_NAME, {
				queued: true,
			})
		).filter((queued) => queued.data.assetRef.id === asset.assetId);
		if (!job) throw new Error("No processing job queued");
		await processOnce(job);

		expect(await statusOf(asset.assetId)).toBe("completed");
		expect(requests).toHaveLength(1);
		const charged = await run(
			Effect.gen(function* () {
				return yield* (yield* DB)
					.select({
						userId: dbSchema.quotaUsageEvent.userId,
					})
					.from(dbSchema.quotaUsageEvent)
					.where(
						and(
							like(
								dbSchema.quotaUsageEvent.appRequestId,
								`image:${asset.assetId}:%`,
							),
							eq(dbSchema.quotaUsageEvent.eventType, "finalized"),
						),
					);
			}),
		);
		expect(charged).toEqual([
			{
				userId: asset.uploaderId,
			},
		]);
	},
	TIMEOUT,
);

test(
	"a document without figures is prepared without its utility model, which it does not need",
	async () => {
		const asset = await run(
			seedVisionAsset({
				capabilities: [
					"text",
					"image",
				],
				document: {
					fileType: "pdf",
					body: pdfWithPages([
						{
							lines: [
								"Refunds are paid within fourteen days of the request.",
							],
						},
					]),
				},
			}),
		);
		// Resolving the asset's owner and utility model now fails.
		await run(
			Effect.gen(function* () {
				yield* (yield* DB)
					.delete(dbSchema.resourceScope)
					.where(eq(dbSchema.resourceScope.resourceId, asset.assetId));
			}),
		);

		await processOnce(delivery(asset, 0));

		expect(await statusOf(asset.assetId)).toBe("completed");
		const stored = await run(readStoredExtraction(asset.assetId));
		expect(stored.chunks.map(({ content }) => content).join(" ")).toContain(
			"Refunds are paid within fourteen days",
		);
		expect(requests).toHaveLength(0);
	},
	TIMEOUT,
);

test(
	"a replayed or superseded delivery describes nothing; each generation is described once",
	async () => {
		const asset = await run(
			seedVisionAsset({
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
		const extraction = await run(readStoredExtraction(asset.assetId));
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
			seedVisionAsset({
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
						config: defaultRepositoryConfig,
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
		expect(await rejection(processOnce(job))).toBeDefined();
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
		seedVisionAsset({
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
					config: defaultRepositoryConfig,
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
			markProcessingExhausted({
				...delivery(asset, 0),
				sourceOutput: {
					message: "handler execution exceeded",
				},
			} as JobWithMetadata<ProcessAssetPayload>),
		);
		await run(
			admit({
				stage: "processing",
				assets: [
					{
						id: asset.assetId,
						generation: 0,
					},
				],
				from: [
					"failed",
				],
			}),
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
						config: defaultRepositoryConfig,
						userId: asset.uploaderId,
					})
					.returning();
				yield* db.insert(dbSchema.blockAsset).values({
					blockId: other.id,
					assetId: asset.assetId,
				});
				const created = yield* db.transaction(() =>
					Effect.gen(function* () {
						const [inserted] = yield* db
							.insert(dbSchema.activityRun)
							.values({
								userId: asset.uploaderId,
								kind: "upload",
								blockId,
							})
							.returning();
						yield* admitStage(inserted.id, [
							{
								stage: "processing",
								assetId: asset.assetId,
								blockId,
							},
						]);
						return inserted;
					}),
				);
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

/** Deletes the asset as resource deletion does, then runs its cleanup. */
const deleteAsset = (assetId: AssetId) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const cleanup = yield* db.transaction(() =>
			Effect.gen(function* () {
				yield* db
					.select({
						id: dbSchema.asset.id,
					})
					.from(dbSchema.asset)
					.where(eq(dbSchema.asset.id, assetId))
					.for("update");
				const [deleted] = yield* db
					.delete(dbSchema.asset)
					.where(eq(dbSchema.asset.id, assetId))
					.returning();
				return yield* recordDeletion({
					files: [
						{
							id: deleted.id,
							bucket: deleted.bucket,
							prefix: deleted.prefix,
							fileType: deleted.fileType,
						},
					],
					indexedLinks: [],
				});
			}),
		);
		yield* cleanUpDeletions([
			cleanup,
		]);
	});

test(
	"a delivery whose asset is deleted while it describes the image stores nothing",
	async () => {
		const asset = await run(
			seedVisionAsset({
				capabilities: [
					"text",
					"image",
				],
			}),
		);
		const gate = Promise.withResolvers<void>();
		held.until = gate.promise;
		try {
			const processing = processOnce(delivery(asset, 0));
			while (requests.length === 0) await sleep(20);
			await run(deleteAsset(asset.assetId));
			gate.resolve();
			await processing;
		} finally {
			gate.resolve();
			held.until = undefined;
		}

		const stored = await run(
			readStoredExtraction(asset.assetId).pipe(
				Effect.flip,
				Effect.map((error) => ("reason" in error ? error.reason : error._tag)),
			),
		);
		expect(stored).toBe("missing");
	},
	TIMEOUT,
);

test(
	"a write interrupted in flight keeps its asset until it lands, so the deletion's cleanup removes it",
	async () => {
		const asset = await run(
			seedVisionAsset({
				capabilities: [
					"text",
					"image",
				],
			}),
		);
		const attempt = {
			assetId: asset.assetId,
			generation: 0,
		};
		expect(await run(claimProcessing(attempt))).toBe(true);
		const putting = Promise.withResolvers<void>();
		const land = Promise.withResolvers<void>();
		const landed = Promise.withResolvers<void>();
		const s3 = await run(S3Service);
		const slow = {
			...s3,
			client: new Proxy(s3.client, {
				get(target, key) {
					if (key === "send")
						return async (command: object, ...rest: unknown[]) => {
							putting.resolve();
							await land.promise;
							try {
								return await Reflect.apply(target.send, target, [
									command,
									...rest,
								]);
							} finally {
								landed.resolve();
							}
						};
					return Reflect.get(target, key);
				},
			}),
		};
		const late = {
			bucket: buckets.processed.name,
			key: `${processedAssetPrefix(asset.assetId)}late.txt`,
		};

		const writing = await run(
			Effect.forkDetach(
				writeWhileProcessing(
					attempt,
					sendPutObjectCommand({
						...late,
						body: "late",
						contentType: "text/plain",
					}),
				).pipe(Effect.provideService(S3Service, slow)),
			),
		);
		await putting.promise;
		// A worker shutting down interrupts its jobs.
		const interrupting = await run(Effect.forkDetach(Fiber.interrupt(writing)));
		const deleting = await run(Effect.forkDetach(deleteAsset(asset.assetId)));
		await run(
			Effect.raceFirst(
				awaitLockWaiters('%"asset"%for update%'),
				Fiber.join(deleting),
			),
		);
		land.resolve();
		await landed.promise;
		await run(Fiber.join(interrupting));
		await run(Fiber.join(deleting));

		const stored = await run(
			sendHeadObjectCommand(late).pipe(
				Effect.as(true),
				Effect.catchIf(isS3NotFound, () => Effect.succeed(false)),
			),
		);
		expect(stored).toBe(false);
	},
	TIMEOUT,
);
