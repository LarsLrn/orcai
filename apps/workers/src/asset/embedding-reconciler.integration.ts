import { afterAll, beforeAll, expect, test } from "bun:test";
import { setTimeout as sleep } from "node:timers/promises";
import { EncryptionKeyLive } from "@orcai/ai";
import { type AssetId, type BlockId, buckets } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import {
	type Job,
	PgBoss,
	PgBossService,
	queueIndexing,
	reconcileEmbeddings,
} from "@orcai/pg-boss";
import {
	buildStoredExtractionKey,
	createImageOnlyStoredExtractionArtifact,
	type StoredExtractionArtifact,
	serializeStoredExtractionArtifact,
} from "@orcai/process";
import {
	configureEmbeddings,
	EmbeddingIndex,
	type EmbeddingIndexScope,
	embeddingSettings,
	QdrantLive,
	QdrantService,
} from "@orcai/qdrant";
import { S3Live, sendPutObjectCommand } from "@orcai/s3/server";
import {
	VECTORIZE_ASSET_JOB_NAME,
	type VectorizeAssetPayload,
} from "@orcai/schema";
import {
	createJobQueues,
	createUser,
	IntegrationLive,
	testEmbeddingIndex,
} from "@orcai/testing";
import { serve } from "bun";
import { and, eq } from "drizzle-orm";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";
import { vectorizeAssetBatch } from "@/asset/jobs/vectorize-asset-job";

const TIMEOUT = 30_000;
const DIMENSIONS = 4;

const boss = new PgBoss({
	host: process.env.POSTGRES_HOST,
	port: Number(process.env.POSTGRES_PORT),
	user: process.env.POSTGRES_USER,
	password: process.env.POSTGRES_PASSWORD,
	database: process.env.POSTGRES_DB,
});
boss.on("error", () => undefined);

/** An OpenAI-compatible endpoint that embeds every value as the same vector. */
const embeddings = serve({
	port: 0,
	fetch: async (request) => {
		const body = (await request.json()) as {
			input: string[];
		};
		return Response.json({
			object: "list",
			data: body.input.map((_, index) => ({
				object: "embedding",
				index,
				embedding: [
					1,
					0,
					0,
					0,
				],
			})),
			model: "integration",
			usage: {
				prompt_tokens: 1,
				total_tokens: 1,
			},
		});
	},
});

/** Holds the next collection Qdrant creates until the test lets it through. */
let creating: Promise<void> | undefined;

const HeldQdrantLive = Layer.effect(
	QdrantService,
	Effect.gen(function* () {
		const service = yield* QdrantService;
		const client = new Proxy(service.client, {
			get: (target, key) => {
				const value = Reflect.get(target, key);
				if (typeof value !== "function") return value;
				if (key !== "createCollection") return value.bind(target);
				return async (...args: unknown[]) => {
					await creating;
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

const runtime = ManagedRuntime.make(
	Layer.mergeAll(
		IntegrationLive,
		S3Live,
		HeldQdrantLive,
		EncryptionKeyLive,
		Layer.succeed(PgBossService, {
			boss,
		}),
	),
);

beforeAll(async () => {
	await boss.start();
	await createJobQueues(boss);
}, TIMEOUT);
afterAll(async () => {
	await embeddings.stop(true);
	await boss.stop({
		graceful: false,
		timeout: 1000,
	});
	await runtime.dispose();
});

type Link = {
	readonly assetId: AssetId;
	readonly blockId: BlockId;
};

/** Runs `effect` on `index`, whose reconciler sees only `link`'s repository. */
const on = <A, E>(
	index: EmbeddingIndexScope,
	link: Link,
	effect: Effect.Effect<
		A,
		E,
		ManagedRuntime.ManagedRuntime.Services<typeof runtime>
	>,
) =>
	runtime.runPromise(
		effect.pipe(
			Effect.provideService(EmbeddingIndex, {
				...index,
				blockIds: [
					link.blockId,
				],
			}),
		),
	);

const configure = (index: EmbeddingIndexScope, link: Link) =>
	on(
		index,
		link,
		configureEmbeddings({
			baseUrl: `${embeddings.url.origin}/v1`,
			apiKey: "key",
			model: "integration",
			dimensions: DIMENSIONS,
		}),
	);

/** A processed asset linked to a fresh repository, with this stored extraction. */
const seed = (
	extraction: Partial<StoredExtractionArtifact> = {
		content: "Refunds rose in February.",
		chunks: [
			{
				content: "Refunds rose in February.",
				chunkType: "text",
				metadata: {
					byteStart: 0,
					byteEnd: 25,
					chunkIndex: 0,
					totalChunks: 1,
				},
			},
		],
	},
): Promise<Link> =>
	runtime.runPromise(
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
					name: "Reconciled repository",
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
						images: [],
						...extraction,
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

const linkOf = (link: Link) =>
	runtime.runPromise(
		Effect.gen(function* () {
			const { blockAsset } = dbSchema;
			const [row] = yield* (yield* DB)
				.select({
					status: blockAsset.indexStatus,
					failure: blockAsset.indexFailure,
					attempt: blockAsset.indexAttempt,
					generation: blockAsset.embeddingGeneration,
				})
				.from(blockAsset)
				.where(
					and(
						eq(blockAsset.assetId, link.assetId),
						eq(blockAsset.blockId, link.blockId),
					),
				);
			return row;
		}),
	);

/** The link's queued indexing jobs. */
const jobsOf = (link: Link) =>
	runtime.runPromise(
		Effect.gen(function* () {
			const { boss } = yield* PgBossService;
			return (yield* Effect.promise(() =>
				boss.findJobs<VectorizeAssetPayload>(VECTORIZE_ASSET_JOB_NAME, {
					data: {
						assetId: link.assetId,
						blockId: link.blockId,
					},
				}),
			)).map((job) => job.data);
		}),
	);

const admit = async (link: Link, index: EmbeddingIndexScope) => {
	const current = await linkOf(link);
	return on(
		index,
		link,
		queueIndexing([
			{
				...link,
				attempt: current?.attempt ?? -1,
			},
		]),
	);
};

const generationOf = async (index: EmbeddingIndexScope, link: Link) =>
	(await on(index, link, embeddingSettings))?.generation;

const collectionsOf = (index: EmbeddingIndexScope) =>
	runtime.runPromise(
		Effect.gen(function* () {
			const { client } = yield* QdrantService;
			const { collections } = yield* Effect.promise(() =>
				client.getCollections(),
			);
			return collections
				.map(({ name }) => name)
				.filter((name) => name.startsWith(`${index.collectionPrefix}-`))
				.sort();
		}),
	);

const vectorize = (
	index: EmbeddingIndexScope,
	link: Link,
	data: VectorizeAssetPayload,
) =>
	on(
		index,
		link,
		vectorizeAssetBatch([
			{
				id: crypto.randomUUID(),
				name: VECTORIZE_ASSET_JOB_NAME,
				data,
			} as Job<VectorizeAssetPayload>,
		]),
	);

const indexes = {
	waiting: await testEmbeddingIndex(),
	racing: await testEmbeddingIndex(),
	legacy: await testEmbeddingIndex(),
	undescribed: await testEmbeddingIndex(),
	wiped: await testEmbeddingIndex(),
};

test(
	"before setup a link waits without a job, and the first setup indexes it from its stored extraction",
	async () => {
		const index = indexes.waiting;
		const link = await seed();
		await admit(link, index);

		expect(await linkOf(link)).toMatchObject({
			status: "pending",
			generation: null,
		});
		expect(await jobsOf(link)).toEqual([]);
		// The reconciler before setup admits nothing.
		expect(await on(index, link, reconcileEmbeddings)).toBe(0);

		await configure(index, link);
		const generation = await generationOf(index, link);
		expect(await on(index, link, reconcileEmbeddings)).toBe(1);
		const admitted = await linkOf(link);
		expect(admitted).toMatchObject({
			status: "pending",
			generation,
		});
		const [job] = await jobsOf(link);
		expect(job).toMatchObject({
			attempt: admitted?.attempt,
			fromStoredExtraction: true,
		});
		// Converged: a second run admits nothing more.
		expect(await on(index, link, reconcileEmbeddings)).toBe(0);

		await vectorize(index, link, job);
		expect(await linkOf(link)).toMatchObject({
			status: "completed",
			generation,
		});
	},
	TIMEOUT,
);

test(
	"a file finishing preparation while the first setup is saved is not lost",
	async () => {
		const index = indexes.racing;
		const link = await seed();
		const release = Promise.withResolvers<void>();
		creating = release.promise;
		const saving = configure(index, link);
		await sleep(200);

		// Processing completes now: the setup is not committed, so the link waits.
		await admit(link, index);
		expect(await linkOf(link)).toMatchObject({
			generation: null,
		});

		release.resolve();
		creating = undefined;
		await saving;
		expect(await on(index, link, reconcileEmbeddings)).toBe(1);
		expect(await linkOf(link)).toMatchObject({
			status: "pending",
			generation: await generationOf(index, link),
		});
		expect(await jobsOf(link)).toHaveLength(1);
	},
	TIMEOUT,
);

test(
	"the first setup of an instance that embedded before re-embeds its indexed files and deletes the old collection",
	async () => {
		const index = indexes.legacy;
		const link = await seed();
		const legacy = `${index.collectionPrefix}-1024`;
		await runtime.runPromise(
			Effect.gen(function* () {
				const { client } = yield* QdrantService;
				yield* Effect.promise(() =>
					client.createCollection(legacy, {
						vectors: {
							dense: {
								size: 1024,
								distance: "Cosine",
							},
						},
					}),
				);
				const { blockAsset } = dbSchema;
				yield* (yield* DB)
					.update(blockAsset)
					.set({
						indexStatus: "completed",
						indexedAttempt: blockAsset.indexAttempt,
					})
					.where(
						and(
							eq(blockAsset.assetId, link.assetId),
							eq(blockAsset.blockId, link.blockId),
						),
					);
			}),
		);

		await configure(index, link);
		expect(await on(index, link, reconcileEmbeddings)).toBe(1);

		const settings = await on(index, link, embeddingSettings);
		expect(await collectionsOf(index)).toEqual([
			String(settings?.collection),
		]);
		expect(await linkOf(link)).toMatchObject({
			status: "pending",
			generation: settings?.generation,
		});
	},
	TIMEOUT,
);

test(
	"re-embedding an extraction older than image descriptions fails the link and prepares nothing again",
	async () => {
		const index = indexes.undescribed;
		const link = await seed({
			content: "Refunds rose in February.",
			images: [
				{
					format: "png",
					sourcePath: "figures/1.png",
					pageNumber: 1,
				} as StoredExtractionArtifact["images"][number],
			],
		});
		await configure(index, link);
		await on(index, link, reconcileEmbeddings);
		const [job] = await jobsOf(link);

		await vectorize(index, link, job);

		expect(await linkOf(link)).toMatchObject({
			status: "failed",
			failure: "missing_extraction",
		});
		const [asset] = await runtime.runPromise(
			Effect.gen(function* () {
				return yield* (yield* DB)
					.select({
						status: dbSchema.asset.processingStatus,
						generation: dbSchema.asset.processingGeneration,
					})
					.from(dbSchema.asset)
					.where(eq(dbSchema.asset.id, link.assetId));
			}),
		);
		expect(asset).toEqual({
			status: "completed",
			generation: 0,
		});
	},
	TIMEOUT,
);

test(
	"a Qdrant that lost the active collection gets it back from the reconciler",
	async () => {
		const index = indexes.wiped;
		const link = await seed();
		await configure(index, link);
		const settings = await on(index, link, embeddingSettings);
		await runtime.runPromise(
			Effect.gen(function* () {
				const { client } = yield* QdrantService;
				yield* Effect.promise(() =>
					client.deleteCollection(settings?.collection ?? ""),
				);
			}),
		);
		expect(await collectionsOf(index)).toEqual([]);

		await on(index, link, reconcileEmbeddings);

		expect(await collectionsOf(index)).toEqual([
			String(settings?.collection),
		]);
	},
	TIMEOUT,
);
