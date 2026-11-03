import { afterAll, afterEach, beforeAll, expect, test } from "bun:test";
import { setTimeout as sleep } from "node:timers/promises";
import { EncryptionKeyLive } from "@orcai/ai";
import { type AssetId, type BlockId, buckets } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import {
	type Job,
	type JobWithMetadata,
	queueIndexing,
	reconcileEmbeddings,
	reconcileLinkPoints,
} from "@orcai/pg-boss";
import { IsolatedPgBossLive } from "@orcai/pg-boss/testing";
import {
	buildStoredExtractionKey,
	createImageOnlyStoredExtractionArtifact,
	serializeStoredExtractionArtifact,
} from "@orcai/process";
import {
	configureEmbeddings,
	EmbeddingGeneration,
	EmbeddingIndex,
	onActiveGeneration,
	QdrantLive,
	QdrantService,
	upsertPointsToQdrant,
	writeGeneration,
} from "@orcai/qdrant";
import { IsolatedEmbeddingIndexLive } from "@orcai/qdrant/testing";
import { S3Live, sendPutObjectCommand } from "@orcai/s3/server";
import type { VectorizeAssetPayload } from "@orcai/schema";
import {
	awaitLockWaiters,
	createUser,
	IntegrationLive,
	integrationRuntime,
} from "@orcai/testing";
import { serve } from "bun";
import { and, eq, sql } from "drizzle-orm";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";
import { vectorizeAssetBatch } from "@/asset/jobs/vectorize-asset-job";
import { markIndexingExhausted } from "@/asset/pipeline-attempt";

const TIMEOUT = 30_000;

/**
 * Requests the endpoint received. While `holding`, each request waits until
 * the test settles it: true answers, false fails it.
 */
const embedding = {
	requests: 0,
	inputs: [] as string[],
	holding: false,
	waiting: [] as ReturnType<typeof Promise.withResolvers<boolean>>[],
};

const dimensions = 8;
const prefixes = {
	queryPrefix: "query: ",
	passagePrefix: "passage:\n",
};

/**
 * An OpenAI-compatible endpoint that embeds every value as the same vector,
 * and a value containing "broken" as one Qdrant rejects.
 */
const embeddings = serve({
	port: 0,
	fetch: async (request) => {
		const body = (await request.json()) as {
			input: string[];
		};
		embedding.requests += 1;
		embedding.inputs.push(...body.input);
		if (embedding.holding) {
			const settled = Promise.withResolvers<boolean>();
			embedding.waiting.push(settled);
			if (!(await settled.promise)) {
				return Response.json(
					{
						error: {
							message: "injected failure",
						},
					},
					{
						status: 400,
					},
				);
			}
		}
		return Response.json({
			object: "list",
			data: body.input.map((value, index) => ({
				object: "embedding",
				index,
				embedding: Array.from(
					{
						length: value.includes("broken") ? 3 : dimensions,
					},
					(_, dimension) => (dimension === 0 ? 1 : 0),
				),
			})),
			model: "integration",
			usage: {
				prompt_tokens: 1,
				total_tokens: 1,
			},
		});
	},
});

/** Runs before each Qdrant write; a test holds or fails one by returning a promise. */
let intercept: (method: string, body: string) => Promise<void> | undefined =
	() => undefined;

const QDRANT_WRITES = new Set([
	"upsert",
	"setPayload",
	"delete",
]);

const InterceptedQdrantLive = Layer.effect(
	QdrantService,
	Effect.gen(function* () {
		const service = yield* QdrantService;
		const client = new Proxy(service.client, {
			get: (target, key) => {
				const value = Reflect.get(target, key);
				if (typeof value !== "function") return value;
				if (!QDRANT_WRITES.has(String(key))) return value.bind(target);
				return async (...args: unknown[]) => {
					await intercept(String(key), JSON.stringify(args[1]));
					return value.apply(target, args);
				};
			},
		});
		return {
			...service,
			client,
		};
	}),
).pipe(Layer.provide(QdrantLive));

const runtime = integrationRuntime(
	IsolatedEmbeddingIndexLive().pipe(
		Layer.provideMerge(
			Layer.mergeAll(
				S3Live,
				InterceptedQdrantLive,
				EncryptionKeyLive,
				IsolatedPgBossLive(),
			),
		),
	),
);
const run = runtime.runPromise;

beforeAll(async () => {
	await run(
		configureEmbeddings({
			baseUrl: `${embeddings.url.origin}/v1`,
			apiKey: "key",
			model: "integration",
			dimensions,
			...prefixes,
		}),
	);
}, TIMEOUT);
afterEach(() => {
	intercept = () => undefined;
});
afterAll(async () => {
	await embeddings.stop(true);
});

/** A processed document linked to a fresh repository, with its stored extraction of `chunks`. */
const seed = (
	chunks: string[] = [
		"Refunds rose in February.",
	],
) =>
	run(
		Effect.gen(function* () {
			const db = yield* DB;
			const user = yield* createUser();
			const [asset] = yield* db
				.insert(dbSchema.asset)
				.values({
					bucket: buckets.main.name,
					prefix: `users/${user.id}/asset`,
					title: "refunds.pdf",
					size: 1,
					fileType: "pdf",
					userId: user.id,
					processingStatus: "completed",
				})
				.returning();
			const [block] = yield* db
				.insert(dbSchema.block)
				.values({
					type: "repository",
					name: "Indexed repository",
					config: {},
					userId: user.id,
				})
				.returning();
			yield* db.insert(dbSchema.blockAsset).values({
				blockId: block.id,
				assetId: asset.id,
			});
			yield* sendPutObjectCommand({
				bucket: buckets.processed.name,
				key: buildStoredExtractionKey(asset.id),
				body: Buffer.from(
					serializeStoredExtractionArtifact({
						...createImageOnlyStoredExtractionArtifact({
							mimeType: "application/pdf",
							format: "pdf",
							sourceBucket: buckets.main.name,
							sourcePath: `${asset.prefix}/${asset.id}.pdf`,
						}),
						content: chunks.join("\n"),
						chunks: chunks.map((content, chunkIndex) => ({
							content,
							chunkType: "text",
							metadata: {
								byteStart: 0,
								byteEnd: content.length,
								chunkIndex,
								totalChunks: chunks.length,
							},
						})),
						images: [],
					}),
				),
				contentType: "application/json",
			});
			return {
				assetId: asset.id,
				blockId: block.id as BlockId,
			};
		}),
	);

/** Starts a new indexing attempt on the link, as Save or Retry does; its job. */
const admit = async (link: { assetId: AssetId; blockId: BlockId }) => {
	const current = await linkOf(link);
	const [data] = await run(
		queueIndexing([
			{
				...link,
				attempt: current?.attempt ?? -1,
			},
		]),
	);
	return {
		id: crypto.randomUUID(),
		name: "vectorize-asset",
		data,
	} as Job<Required<VectorizeAssetPayload>>;
};

const vectorize = (job: Job<VectorizeAssetPayload>) =>
	run(
		vectorizeAssetBatch([
			job,
		]),
	);

/** Runs `jobs` until each asks for embeddings, which wait for the test to settle them in order. */
const held = async (...jobs: Job<VectorizeAssetPayload>[]) => {
	const waiting = embedding.waiting.length;
	embedding.holding = true;
	const running = jobs.map((job) => vectorize(job));
	while (embedding.waiting.length < waiting + jobs.length) {
		await sleep(25);
	}
	embedding.holding = false;
	const requests = embedding.waiting.slice(waiting);
	return {
		settle: (index: number, answer: boolean) => requests[index].resolve(answer),
		done: () => Promise.allSettled(running),
	};
};

const linkOf = (link: { assetId: AssetId; blockId: BlockId }) =>
	run(
		Effect.gen(function* () {
			const [row] = yield* (yield* DB)
				.select({
					status: dbSchema.blockAsset.indexStatus,
					attempt: dbSchema.blockAsset.indexAttempt,
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

/** The indexing attempt of each of the link's points. */
const pointsOf = async (link: { assetId: AssetId; blockId: BlockId }) =>
	(await payloadsOf(link)).map((payload) => payload?.index_attempt ?? null);

/** The indexing attempt of each of the link's served points. */
const servedOf = async (link: { assetId: AssetId; blockId: BlockId }) =>
	(await payloadsOf(link))
		.filter((payload) => payload?.published !== false)
		.map((payload) => payload?.index_attempt ?? null);

/** Whether each of the link's points is served. */
const publishedOf = async (link: { assetId: AssetId; blockId: BlockId }) =>
	(await payloadsOf(link)).map((payload) => payload?.published ?? null);

const payloadsOf = (link: { assetId: AssetId; blockId: BlockId }) =>
	run(
		Effect.gen(function* () {
			const { client } = yield* QdrantService;
			const collection = yield* onActiveGeneration(
				EmbeddingGeneration.pipe(
					Effect.map((generation) => generation.collection),
				),
			);
			const { points } = yield* Effect.promise(() =>
				client.scroll(collection, {
					filter: {
						must: [
							{
								key: "asset_id",
								match: {
									value: link.assetId,
								},
							},
							{
								key: "block_id",
								match: {
									value: link.blockId,
								},
							},
						],
					},
					with_payload: true,
					limit: 100,
				}),
			);
			return points.map((point) => point.payload);
		}),
	);

/**
 * Holds the next Qdrant write `matches` picks until the test settles it: true
 * lets it through, false fails it.
 */
const holdWrite = (matches: (method: string, body: string) => boolean) => {
	const reached = Promise.withResolvers<void>();
	const settled = Promise.withResolvers<boolean>();
	let armed = true;
	intercept = (method, body) => {
		if (!armed || !matches(method, body)) return undefined;
		armed = false;
		reached.resolve();
		return settled.promise.then((pass) => {
			if (!pass) throw new Error("injected Qdrant failure");
		});
	};
	return {
		reached: reached.promise,
		settle: (pass: boolean) => settled.resolve(pass),
	};
};

/** Serving the points of `attempt`. */
const publishing = (attempt: number) => (method: string, body: string) =>
	method === "setPayload" &&
	body.includes('"published":true') &&
	body.includes(`"gte":${attempt},`);

/** No longer serving the points of every attempt before `attempt`. */
const unpublishingBefore =
	(attempt: number) => (method: string, body: string) =>
		method === "setPayload" &&
		body.includes('"published":false') &&
		body.includes(`"range":{"lt":${attempt}}`);

/** No longer serving the points of every attempt after `attempt`. */
const unpublishingAfter = (attempt: number) => (method: string, body: string) =>
	method === "setPayload" &&
	body.includes('"published":false') &&
	body.includes(`"range":{"gte":${attempt + 1}}`);

/** Deleting the points of every attempt before `attempt`. */
const deletingBefore = (attempt: number) => (method: string, body: string) =>
	method === "delete" && body.includes(`"range":{"lt":${attempt}}`);

const waitingForLinkLock = () =>
	run(awaitLockWaiters("%pg_advisory_xact_lock%"));

const until = async (condition: () => Promise<boolean>) => {
	while (!(await condition())) {
		await sleep(25);
	}
};

/** A point `attempt` wrote for the link, outside any delivery the test runs. */
const writePoint = (
	link: {
		assetId: AssetId;
		blockId: BlockId;
	},
	attempt: number | undefined,
	published?: boolean,
) =>
	run(
		writeGeneration(
			upsertPointsToQdrant({
				points: [
					{
						id: crypto.randomUUID(),
						vector: Array.from(
							{
								length: dimensions,
							},
							(_, dimension) => (dimension === 1 ? 1 : 0),
						),
						payload: {
							source: "text",
							asset_id: link.assetId,
							block_id: link.blockId,
							text: "Refunds fell in January.",
							depth: 0,
							tokens: 5,
							chunk_index: 0,
							chunkCount: 1,
							createdAt: new Date().toISOString(),
							index_attempt: attempt,
							published,
						},
					},
				],
			}),
		),
	);

test(
	"a completed attempt replaces the link's earlier points, and a duplicate delivery changes nothing",
	async () => {
		const link = await seed();
		// A point an earlier release wrote, without an attempt.
		await writePoint(link, undefined);
		const job = await admit(link);

		await vectorize(job);
		await vectorize(job);

		expect(await linkOf(link)).toEqual({
			status: "completed",
			attempt: job.data.attempt,
		});
		expect(await pointsOf(link)).toEqual([
			job.data.attempt,
		]);
		expect(await publishedOf(link)).toEqual([
			true,
		]);
		expect(embedding.requests).toBeGreaterThan(0);
	},
	TIMEOUT,
);

test(
	"passages are embedded after the passage prefix, while their stored and lexical text stay without it",
	async () => {
		const link = await seed();
		const job = await admit(link);
		const before = embedding.inputs.length;

		await vectorize(job);

		expect(embedding.inputs.slice(before)).toEqual([
			"passage:\nRefunds rose in February.",
		]);
		const [payload] = await payloadsOf(link);
		expect(payload?.text).toBe("Refunds rose in February.");
		expect(payload?.lexical_text).toBeUndefined();
	},
	TIMEOUT,
);

test(
	"an attempt replaced while it embeds leaves no points and keeps the newer attempt's",
	async () => {
		const link = await seed();
		const older = await admit(link);
		const late = await held(older);

		const newer = await admit(link);
		await vectorize(newer);
		late.settle(0, true);
		await late.done();

		expect(await linkOf(link)).toEqual({
			status: "completed",
			attempt: newer.data.attempt,
		});
		expect(await pointsOf(link)).toEqual([
			newer.data.attempt,
		]);
	},
	TIMEOUT,
);

test(
	"a link removed and added again while indexing keeps none of the old attempt's points",
	async () => {
		const link = await seed();
		const job = await admit(link);
		const late = await held(job);

		await run(
			Effect.gen(function* () {
				const db = yield* DB;
				const where = and(
					eq(dbSchema.blockAsset.assetId, link.assetId),
					eq(dbSchema.blockAsset.blockId, link.blockId),
				);
				yield* db.delete(dbSchema.blockAsset).where(where);
				yield* reconcileLinkPoints(link);
				yield* db.insert(dbSchema.blockAsset).values(link);
			}),
		);
		late.settle(0, true);
		await late.done();

		const relinked = await linkOf(link);
		expect(relinked?.status).toBe("pending");
		expect(relinked?.attempt).not.toBe(job.data.attempt);
		expect(await pointsOf(link)).toEqual([]);
	},
	TIMEOUT,
);

test(
	"two deliveries of one attempt at once publish one set of points, even when the second fails",
	async () => {
		const link = await seed();
		const job = await admit(link);
		const both = await held(job, job);

		both.settle(0, true);
		while ((await linkOf(link))?.status !== "completed") {
			await sleep(25);
		}
		both.settle(1, false);
		await both.done();

		expect(await linkOf(link)).toEqual({
			status: "completed",
			attempt: job.data.attempt,
		});
		expect(await pointsOf(link)).toEqual([
			job.data.attempt,
		]);
	},
	TIMEOUT,
);

test(
	"an attempt replaced before its upsert fails partway leaves none of its points",
	async () => {
		// Two upsert batches; Qdrant rejects the second.
		const link = await seed(
			Array.from(
				{
					length: 65,
				},
				(_, index) => (index === 64 ? "A broken chunk." : `Chunk ${index}.`),
			),
		);
		const older = await admit(link);
		const late = await held(older);

		await admit(link);
		late.settle(0, true);
		await late.done();

		expect((await linkOf(link))?.status).toBe("pending");
		expect(await pointsOf(link)).toEqual([]);
	},
	TIMEOUT,
);

test(
	"an attempt dead-lettered while it embeds leaves none of its points, and the indexed attempt's stay",
	async () => {
		const link = await seed();
		const first = await admit(link);
		await vectorize(first);
		const job = await admit(link);
		const late = await held(job);

		await run(
			markIndexingExhausted([
				{
					id: crypto.randomUUID(),
					data: job.data,
					sourceOutput: {
						message: "job heartbeat timeout",
					},
				} as JobWithMetadata<VectorizeAssetPayload>,
			]),
		);
		late.settle(0, true);
		await late.done();

		expect(await linkOf(link)).toEqual({
			status: "failed",
			attempt: job.data.attempt,
		});
		expect(await pointsOf(link)).toEqual([
			first.data.attempt,
		]);
		expect(await publishedOf(link)).toEqual([
			true,
		]);
	},
	TIMEOUT,
);

test(
	"a later delivery that skips the attempt still removes the points an earlier one left",
	async () => {
		const link = await seed();
		const older = await admit(link);
		// The earlier delivery stopped between its upsert and its reconcile.
		await writePoint(link, older.data.attempt);
		// Prepare again replaces the attempt and leaves processing unfinished.
		await run(
			Effect.gen(function* () {
				const db = yield* DB;
				yield* db
					.update(dbSchema.asset)
					.set({
						processingStatus: "pending",
					})
					.where(eq(dbSchema.asset.id, link.assetId));
			}),
		);
		await admit(link);

		await vectorize(older);

		expect(await pointsOf(link)).toEqual([]);
	},
	TIMEOUT,
);

test(
	"a retry after a failed flip publishes the completed attempt, then removes the earlier one",
	async () => {
		const link = await seed();
		const first = await admit(link);
		await vectorize(first);
		const job = await admit(link);
		// The attempt completed and wrote its points, but its reconcile failed before the flip.
		await writePoint(link, job.data.attempt, false);
		await run(
			Effect.gen(function* () {
				yield* (yield* DB)
					.update(dbSchema.blockAsset)
					.set({
						indexStatus: "completed",
						indexedAttempt: job.data.attempt,
					})
					.where(
						and(
							eq(dbSchema.blockAsset.assetId, link.assetId),
							eq(dbSchema.blockAsset.blockId, link.blockId),
						),
					);
			}),
		);
		expect(
			[
				...(await publishedOf(link)),
			].sort(),
		).toEqual([
			false,
			true,
		]);

		await vectorize(job);

		expect(await pointsOf(link)).toEqual([
			job.data.attempt,
		]);
		expect(await publishedOf(link)).toEqual([
			true,
		]);
	},
	TIMEOUT,
);

test(
	"a duplicate delivery that embedded before the attempt completed leaves its points served",
	async () => {
		const link = await seed();
		await vectorize(await admit(link));
		const job = await admit(link);
		const both = await held(job, job);

		both.settle(0, true);
		await until(
			async () =>
				JSON.stringify(await pointsOf(link)) ===
				JSON.stringify([
					job.data.attempt,
				]),
		);
		// The late delivery stops before its reconcile.
		const reconcile = holdWrite((method) => method !== "upsert");
		both.settle(1, true);
		await reconcile.reached;

		expect(await servedOf(link)).toEqual([
			job.data.attempt,
		]);
		reconcile.settle(true);
		await both.done();
		expect(await servedOf(link)).toEqual([
			job.data.attempt,
		]);
	},
	TIMEOUT,
);

test(
	"a stale reconcile of the indexed attempt, resumed after the newer one failed to delete it, serves only the newer",
	async () => {
		const link = await seed();
		const older = await admit(link);
		await vectorize(older);
		const newer = await admit(link);
		const stale = holdWrite(publishing(older.data.attempt));
		const staleRun = vectorize(older);
		await stale.reached;

		const newerRun = vectorize(newer);
		await waitingForLinkLock();
		expect(await servedOf(link)).toEqual([
			older.data.attempt,
		]);
		holdWrite(deletingBefore(newer.data.attempt)).settle(false);
		stale.settle(true);
		await staleRun;
		await expect(newerRun).rejects.toThrow();

		expect(await servedOf(link)).toEqual([
			newer.data.attempt,
		]);
		await vectorize(newer);
		expect(await pointsOf(link)).toEqual([
			newer.data.attempt,
		]);
		expect(await servedOf(link)).toEqual([
			newer.data.attempt,
		]);
	},
	TIMEOUT,
);

test(
	"a link reads completed only once the attempt's points are served",
	async () => {
		const link = await seed();
		const job = await admit(link);
		const publish = holdWrite(publishing(job.data.attempt));
		const running = vectorize(job);
		await publish.reached;

		expect((await linkOf(link))?.status).toBe("active");
		expect(await servedOf(link)).toEqual([]);
		publish.settle(true);
		await running;

		expect(await linkOf(link)).toEqual({
			status: "completed",
			attempt: job.data.attempt,
		});
		expect(await servedOf(link)).toEqual([
			job.data.attempt,
		]);
	},
	TIMEOUT,
);

test(
	"a completion that fails after publishing serves the indexed attempt again, and its retry completes",
	async () => {
		const link = await seed();
		const older = await admit(link);
		await vectorize(older);
		const newer = await admit(link);
		holdWrite(unpublishingBefore(newer.data.attempt)).settle(false);

		await expect(vectorize(newer)).rejects.toThrow();

		expect((await linkOf(link))?.status).toBe("active");
		expect(await servedOf(link)).toEqual([
			older.data.attempt,
		]);
		await vectorize(newer);
		expect(await linkOf(link)).toEqual({
			status: "completed",
			attempt: newer.data.attempt,
		});
		expect(await pointsOf(link)).toEqual([
			newer.data.attempt,
		]);
		expect(await servedOf(link)).toEqual([
			newer.data.attempt,
		]);
	},
	TIMEOUT,
);

test(
	"a retry after a completion and its reconcile failed past unpublishing the indexed attempt keeps serving",
	async () => {
		const link = await seed();
		const older = await admit(link);
		await vectorize(older);
		const newer = await admit(link);
		// As if the worker died before the commit: only the newer attempt is served.
		const completion = holdWrite(unpublishingAfter(newer.data.attempt));
		completion.settle(false);
		const failed = vectorize(newer);
		await completion.reached;
		holdWrite(publishing(older.data.attempt)).settle(false);
		await expect(failed).rejects.toThrow();
		expect(await servedOf(link)).toEqual([
			newer.data.attempt,
		]);

		const publish = holdWrite(publishing(newer.data.attempt));
		const retry = vectorize(newer);
		await publish.reached;
		expect((await linkOf(link))?.status).toBe("active");
		expect(await servedOf(link)).toEqual([
			older.data.attempt,
		]);
		publish.settle(true);
		await retry;

		expect(await pointsOf(link)).toEqual([
			newer.data.attempt,
		]);
		expect(await servedOf(link)).toEqual([
			newer.data.attempt,
		]);
	},
	TIMEOUT,
);

test(
	"an earlier attempt's cleanup while the newer one's publish is held, then failing, keeps serving",
	async () => {
		const link = await seed();
		const older = await admit(link);
		await vectorize(older);
		const newer = await admit(link);
		const publish = holdWrite(publishing(newer.data.attempt));
		const newerRun = vectorize(newer);
		await publish.reached;

		const cleanup = run(
			markIndexingExhausted([
				{
					id: crypto.randomUUID(),
					data: older.data,
					sourceOutput: {
						message: "job heartbeat timeout",
					},
				} as JobWithMetadata<VectorizeAssetPayload>,
			]),
		);
		await waitingForLinkLock();
		expect(await servedOf(link)).toEqual([
			older.data.attempt,
		]);
		publish.settle(false);
		await expect(newerRun).rejects.toThrow();
		await cleanup;

		expect(await linkOf(link)).toEqual({
			status: "active",
			attempt: newer.data.attempt,
		});
		expect(await servedOf(link)).toEqual([
			older.data.attempt,
		]);
		await vectorize(newer);
		expect(await pointsOf(link)).toEqual([
			newer.data.attempt,
		]);
		expect(await servedOf(link)).toEqual([
			newer.data.attempt,
		]);
	},
	TIMEOUT,
);

/** Activates a newer generation as a model change would, with a collection of its own. */
const switchGeneration = () =>
	run(
		Effect.gen(function* () {
			const { settings } = yield* EmbeddingIndex;
			yield* (yield* DB).update(settings).set({
				embeddingGeneration: sql`nextval('embedding_generation_seq')`,
				embeddingCollection: sql`${settings.embeddingCollection} || '-next'`,
			});
		}),
	);

const reconcile = (link: { blockId: BlockId }) =>
	run(
		EmbeddingIndex.pipe(
			Effect.flatMap((index) =>
				reconcileEmbeddings.pipe(
					Effect.provideService(EmbeddingIndex, {
						...index,
						blockIds: [
							link.blockId,
						],
					}),
				),
			),
		),
	);

test(
	"a point write in flight holds a save of the embedding setting until it is done",
	async () => {
		const link = await seed();
		const job = await admit(link);
		const upsert = holdWrite((method) => method === "upsert");
		const running = vectorize(job);
		await upsert.reached;

		// Another app process, on a connection of its own.
		const index = await run(EmbeddingIndex);
		const other = ManagedRuntime.make(
			Layer.mergeAll(IntegrationLive, QdrantLive, EncryptionKeyLive),
		);
		let saved = false;
		const save = other
			.runPromise(
				configureEmbeddings({
					baseUrl: `${embeddings.url.origin}/v1`,
					apiKey: "key",
					model: "integration",
					dimensions,
					...prefixes,
				}).pipe(Effect.provideService(EmbeddingIndex, index)),
			)
			.then(() => {
				saved = true;
			});
		await sleep(300);
		expect(saved).toBe(false);

		upsert.settle(true);
		await save;
		await running;
		await other.dispose();

		expect(await linkOf(link)).toEqual({
			status: "completed",
			attempt: job.data.attempt,
		});
	},
	TIMEOUT,
);

test(
	"a delivery whose generation was replaced while it embedded writes nothing, is not retried, and is admitted again",
	async () => {
		const link = await seed();
		const job = await admit(link);
		const late = await held(job);

		await switchGeneration();
		late.settle(0, true);
		const [settled] = await late.done();

		expect(settled.status).toBe("fulfilled");
		expect(await linkOf(link)).toEqual({
			status: "active",
			attempt: job.data.attempt,
		});
		expect(await pointsOf(link)).toEqual([]);

		expect(await reconcile(link)).toBe(1);
		const readmitted = await linkOf(link);
		expect(readmitted?.status).toBe("pending");
		expect(readmitted?.attempt).toBeGreaterThan(job.data.attempt);
	},
	TIMEOUT,
);

test(
	"a delivery paused between its point write and its completion completes nothing on a replaced generation",
	async () => {
		const link = await seed();
		const job = await admit(link);
		const upsert = holdWrite((method) => method === "upsert");
		const running = vectorize(job);
		await upsert.reached;
		// Past its generation check, so its points land in the old collection.
		await switchGeneration();
		upsert.settle(true);
		const [settled] = await Promise.allSettled([
			running,
		]);

		expect(settled.status).toBe("fulfilled");
		expect(await linkOf(link)).toEqual({
			status: "active",
			attempt: job.data.attempt,
		});
		expect(await pointsOf(link)).toEqual([]);
	},
	TIMEOUT,
);
