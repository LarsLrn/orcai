import { afterAll, afterEach, beforeAll, expect, test } from "bun:test";
import { EncryptionKeyLive } from "@orcai/ai";
import {
	type ActivityRunId,
	type AssetId,
	type BlockId,
	buckets,
	type UserId,
} from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { type Job, type PgBoss, PgBossService } from "@orcai/pg-boss";
import { IsolatedPgBossLive } from "@orcai/pg-boss/testing";
import {
	admit as admitPreparation,
	embeddingProgress,
	embeddingsRebuilding,
	prepareAssetAgain,
	prepareMissingExtractionsAgain,
	reconcileEmbeddings,
	retryFailedEmbeddings,
	startPreparingMissingExtractionsAgain,
} from "@orcai/preparation";
import {
	buildStoredExtractionKey,
	createImageOnlyExtractionArtifact,
	type StoredExtractionArtifact,
	serializeStoredExtractionArtifact,
} from "@orcai/process";
import {
	activeGeneration,
	configureEmbeddings,
	EmbeddingIndex,
	type EmbeddingIndexScope,
	embeddingSettings,
	QdrantLive,
	QdrantService,
	servedFilter,
} from "@orcai/qdrant";
import { testEmbeddingIndex } from "@orcai/qdrant/testing";
import { assetObjectKey } from "@orcai/s3";
import { S3Live, sendPutObjectCommand } from "@orcai/s3/server";
import {
	defaultRepositoryConfig,
	type PipelineFailure,
	PREPARE_MISSING_EXTRACTIONS_AGAIN_JOB_NAME,
	PROCESS_ASSET_JOB_NAME,
	type PrepareMissingExtractionsAgainPayload,
	type ProcessAssetPayload,
	VECTORIZE_ASSET_JOB_NAME,
	type VectorizeAssetPayload,
} from "@orcai/schema";
import {
	awaitLockWaiters,
	createOrganization,
	createUser,
	integrationRuntime,
} from "@orcai/testing";
import { serve } from "bun";
import { and, eq } from "drizzle-orm";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import type * as ManagedRuntime from "effect/ManagedRuntime";
import { assetWorkers } from "@/asset/definitions";
import { vectorizeAsset } from "@/asset/jobs/vectorize-asset-job";

const TIMEOUT = 30_000;
const DIMENSIONS = 4;

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

let held:
	| {
			readonly reach: () => void;
			readonly release: Promise<void>;
			readonly free: () => void;
	  }
	| undefined;

/**
 * Holds the collections Qdrant creates until `release`. `reached(running)`
 * settles once one is held, and fails if `running` ends first.
 */
const holdCollections = () => {
	const reached = Promise.withResolvers<void>();
	const release = Promise.withResolvers<void>();
	const free = () => {
		held = undefined;
		release.resolve();
	};
	held = {
		reach: reached.resolve,
		release: release.promise,
		free,
	};
	return {
		reached: (running: Promise<unknown>) =>
			Promise.race([
				reached.promise,
				running.then(() => {
					throw new Error("Finished without creating a collection");
				}),
			]),
		release: free,
	};
};

// A failed test must not leave a later collection waiting.
afterEach(() => held?.free());

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
					if (held) {
						held.reach();
						await held.release;
					}
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
	Layer.mergeAll(
		S3Live,
		HeldQdrantLive,
		EncryptionKeyLive,
		IsolatedPgBossLive(),
	),
);

let boss: PgBoss;
beforeAll(async () => {
	boss = await runtime.runPromise(PgBossService.useSync(({ boss }) => boss));
});
afterAll(() => embeddings.stop(true));

type Link = {
	readonly assetId: AssetId;
	readonly blockId: BlockId;
};

/** Runs `effect` on `index`, whose reconciler sees only the links' repositories. */
const on = <A, E>(
	index: EmbeddingIndexScope,
	link: Link | readonly Link[],
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
				blockIds: (Array.isArray(link)
					? link
					: [
							link,
						]
				).map(({ blockId }) => blockId),
			}),
		),
	);

const configure = (
	index: EmbeddingIndexScope,
	link: Link | readonly Link[],
	model = "integration",
) =>
	on(
		index,
		link,
		Effect.gen(function* () {
			const active = yield* activeGeneration;
			return yield* configureEmbeddings(
				{
					baseUrl: `${embeddings.url.origin}/v1`,
					apiKey: "key",
					model,
					dimensions: DIMENSIONS,
					queryPrefix: "",
					passagePrefix: "",
				},
				{
					reembedGeneration: active,
				},
			);
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
					config: defaultRepositoryConfig,
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
						...createImageOnlyExtractionArtifact({
							mimeType: "application/pdf",
							format: "pdf",
							sourceBucket: buckets.main.name,
							sourcePath: assetObjectKey(asset),
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
		admitPreparation({
			stage: "indexing",
			links: [
				{
					...link,
					attempt: current?.attempt ?? -1,
				},
			],
		}),
	);
};

/** An instance admin, who starts the instance-wide actions. */
const admin = () =>
	runtime.runPromise(createUser().pipe(Effect.map((user): UserId => user.id)));

/** How each member of the run stands, by stage. */
const membersOf = (runId: ActivityRunId) =>
	runtime.runPromise(
		Effect.gen(function* () {
			const { activityMember } = dbSchema;
			return yield* (yield* DB)
				.select({
					assetId: activityMember.assetId,
					blockId: activityMember.blockId,
					processing: activityMember.processingState,
					indexing: activityMember.indexingState,
				})
				.from(activityMember)
				.where(eq(activityMember.runId, runId));
		}),
	);

/** The run's leases still open. */
const leasesOf = (runId: ActivityRunId) =>
	runtime.runPromise(
		Effect.gen(function* () {
			const { activityAdmission } = dbSchema;
			return (yield* (yield* DB)
				.select({
					id: activityAdmission.id,
				})
				.from(activityAdmission)
				.where(eq(activityAdmission.runId, runId))).length;
		}),
	);

/** Takes the queued instance preparation job, as its worker would. */
const takePreparation = async () => {
	const [taken] = await boss.fetch<PrepareMissingExtractionsAgainPayload>(
		PREPARE_MISSING_EXTRACTIONS_AGAIN_JOB_NAME,
	);
	if (!taken) throw new Error("No preparation job queued");
	return taken;
};

const generationOf = async (
	index: EmbeddingIndexScope,
	link: Link | readonly Link[],
) => (await on(index, link, embeddingSettings))?.generation;

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
	link: Link | readonly Link[],
	data: VectorizeAssetPayload,
) =>
	on(
		index,
		link,
		vectorizeAsset({
			id: crypto.randomUUID(),
			name: VECTORIZE_ASSET_JOB_NAME,
			data,
		} as Job<VectorizeAssetPayload>),
	);

const indexes = {
	waiting: await testEmbeddingIndex(),
	racing: await testEmbeddingIndex(),
	legacy: await testEmbeddingIndex(),
	undescribed: await testEmbeddingIndex(),
	wiped: await testEmbeddingIndex(),
	switched: await testEmbeddingIndex(),
	retried: await testEmbeddingIndex(),
	failedBefore: await testEmbeddingIndex(),
	racingFlag: await testEmbeddingIndex(),
	preparedAgain: await testEmbeddingIndex(),
	preparedWhileSwitching: await testEmbeddingIndex(),
	preparedInBackground: await testEmbeddingIndex(),
	preparedTogether: await testEmbeddingIndex(),
	preparedJoined: await testEmbeddingIndex(),
	preparedBesidePersonal: await testEmbeddingIndex(),
};

/** The rebuild flag as stored, before any derivation. */
const rebuildFlagOf = (index: EmbeddingIndexScope) =>
	runtime.runPromise(
		Effect.gen(function* () {
			const [row] = yield* (yield* DB)
				.select({
					flag: index.settings.embeddingRebuilding,
				})
				.from(index.settings);
			return row?.flag;
		}),
	);

/** How many points the collection holds. */
const pointsIn = (collection: string) =>
	runtime.runPromise(
		Effect.gen(function* () {
			const { client } = yield* QdrantService;
			const { count } = yield* Effect.promise(() =>
				client.count(collection, {
					exact: true,
				}),
			);
			return count;
		}),
	);

/** How many points search finds for the link in the collection. */
const servedPointsOf = (collection: string, link: Link) =>
	runtime.runPromise(
		Effect.gen(function* () {
			const { client } = yield* QdrantService;
			const { count } = yield* Effect.promise(() =>
				client.count(collection, {
					exact: true,
					filter: servedFilter({
						must: [
							{
								key: "block_id",
								match: {
									value: link.blockId,
								},
							},
							{
								key: "asset_id",
								match: {
									value: link.assetId,
								},
							},
						],
					}),
				}),
			);
			return count;
		}),
	);

/** Sets the link's indexing to `status`, failed with `failure`. */
const settle = (
	link: Link,
	status: "completed" | "failed",
	failure?: PipelineFailure,
) =>
	runtime.runPromise(
		Effect.gen(function* () {
			const { blockAsset } = dbSchema;
			yield* (yield* DB)
				.update(blockAsset)
				.set({
					indexStatus: status,
					indexFailure: failure ?? null,
				})
				.where(
					and(
						eq(blockAsset.assetId, link.assetId),
						eq(blockAsset.blockId, link.blockId),
					),
				);
		}),
	);

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
		const hold = holdCollections();
		const saving = configure(index, link);
		await hold.reached(saving);

		// Processing completes now: the setup is not committed, so the link waits.
		await admit(link, index);
		expect(await linkOf(link)).toMatchObject({
			generation: null,
		});

		hold.release();
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
	"an extraction older than image descriptions fails its link as missing, and Prepare again prepares the file again",
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
		const before = await processingOf(link);

		await vectorize(index, link, job);

		expect(await linkOf(link)).toMatchObject({
			status: "failed",
			failure: "missing_extraction",
		});
		expect(await processingOf(link)).toEqual(before);

		await on(index, link, startPreparingMissingExtractionsAgain(await admin()));
		const preparation = await takePreparation();
		expect(
			await on(index, link, prepareMissingExtractionsAgain(preparation.data)),
		).toBe(1);
		await boss.complete(
			PREPARE_MISSING_EXTRACTIONS_AGAIN_JOB_NAME,
			preparation.id,
		);
		expect(await processingOf(link)).toEqual({
			status: "pending",
			generation: Number(before.generation) + 1,
			jobs: before.jobs + 1,
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

test(
	"a model change moves search to a new collection at once, deletes the old one and re-embeds every link, and a job of the old model writes nothing",
	async () => {
		const index = indexes.switched;
		const links = [
			await seed(),
			await seed(),
		];
		const [indexed, inFlight] = links;
		await configure(index, links);
		const before = await on(index, links, embeddingSettings);
		await on(index, links, reconcileEmbeddings);
		const [indexedJob] = await jobsOf(indexed);
		const [oldJob] = await jobsOf(inFlight);
		await vectorize(index, links, indexedJob);
		expect(await linkOf(indexed)).toMatchObject({
			status: "completed",
		});
		const oldPoints = await pointsIn(String(before?.collection));
		expect(oldPoints).toBeGreaterThan(0);

		await configure(index, links, "another");
		const after = await on(index, links, embeddingSettings);
		expect(after?.model).toBe("another");
		expect(await on(index, links, embeddingsRebuilding)).toBe(true);

		// Admitted for the old model, delivered after the switch: nothing lands anywhere.
		const pending = await linkOf(inFlight);
		await vectorize(index, links, oldJob);
		expect(await linkOf(inFlight)).toEqual(pending);
		expect(await pointsIn(String(after?.collection))).toBe(0);

		expect(await on(index, links, reconcileEmbeddings)).toBe(2);
		expect(await collectionsOf(index)).toEqual([
			String(after?.collection),
		]);
		for (const link of links) {
			expect(await linkOf(link)).toMatchObject({
				status: "pending",
				generation: after?.generation,
			});
		}
		expect(await on(index, links, embeddingsRebuilding)).toBe(true);

		for (const link of links) {
			const jobs = await jobsOf(link);
			const current = await linkOf(link);
			const job = jobs.find(({ attempt }) => attempt === current?.attempt);
			expect(job).toBeDefined();
			if (job) await vectorize(index, links, job);
			expect(await linkOf(link)).toMatchObject({
				status: "completed",
				generation: after?.generation,
			});
		}
		expect(await pointsIn(String(after?.collection))).toBe(oldPoints * 2);

		// Every link settled: the rebuild is over.
		expect(await on(index, links, embeddingsRebuilding)).toBe(false);
	},
	TIMEOUT,
);

test(
	"Retry failed admits only the failed links re-embedding can help, and the counts name no file",
	async () => {
		const index = indexes.retried;
		const links = [
			await seed(),
			await seed(),
			await seed(),
			await seed(),
			await seed(),
		];
		// The last one stays waiting.
		const [embedded, broken, missing, empty] = links;
		const { organization } = await runtime.runPromise(createOrganization());
		await runtime.runPromise(
			Effect.gen(function* () {
				yield* (yield* DB).insert(dbSchema.resourceScope).values(
					[
						embedded,
						broken,
					].map((link) => ({
						resourceType: "block" as const,
						resourceId: link.blockId,
						organizationId: organization.id,
					})),
				);
			}),
		);
		await configure(index, links);
		await on(index, links, reconcileEmbeddings);
		await settle(embedded, "completed");
		await settle(broken, "failed", "other");
		await settle(missing, "failed", "missing_extraction");
		await settle(empty, "failed", "empty");
		const generation = await generationOf(index, links);

		const progress = await on(index, links, embeddingProgress);
		expect(progress).toEqual({
			generation: Number(generation),
			rebuilding: true,
			organizations: [
				{
					organizationId: organization.id,
					name: organization.name,
					embedded: 1,
					waiting: 0,
					failed: 1,
				},
				{
					organizationId: null,
					name: null,
					embedded: 0,
					waiting: 1,
					failed: 2,
				},
			],
			failures: [
				{
					failure: "empty",
					count: 1,
				},
				{
					failure: "other",
					count: 1,
				},
				{
					failure: "missing_extraction",
					count: 1,
				},
			],
			retryable: 1,
			preparable: 1,
		});
		expect(JSON.stringify(progress)).not.toContain(broken.blockId);
		expect(JSON.stringify(progress)).not.toContain("refunds.pdf");

		const before = await Promise.all(links.map(linkOf));
		const userId = await admin();
		expect(await on(index, links, retryFailedEmbeddings(userId))).toBe(1);

		const after = await Promise.all(links.map(linkOf));
		expect(after[1]).toMatchObject({
			status: "pending",
			failure: null,
			generation,
		});
		expect(after[1]?.attempt).not.toBe(before[1]?.attempt);
		expect([
			after[0],
			after[2],
			after[3],
			after[4],
		]).toEqual([
			before[0],
			before[2],
			before[3],
			before[4],
		]);
		const retried = (await jobsOf(broken)).find(
			({ attempt }) => attempt === after[1]?.attempt,
		);
		expect(retried).toBeDefined();
		// The admin's run took the link on, so their Activity follows it.
		expect(await membersOf(retried?.runId as ActivityRunId)).toEqual([
			{
				assetId: broken.assetId,
				blockId: broken.blockId,
				processing: null,
				indexing: "pending",
			},
		]);
	},
	TIMEOUT,
);

test(
	"a link that failed before setup counts as waiting until the new generation embeds it",
	async () => {
		const index = indexes.failedBefore;
		const link = await seed();
		await admit(link, index);
		await settle(link, "failed", "other");
		expect(await linkOf(link)).toMatchObject({
			generation: null,
		});

		await configure(index, link);

		expect(await on(index, link, embeddingsRebuilding)).toBe(true);
		expect((await on(index, link, embeddingProgress))?.organizations).toEqual([
			{
				organizationId: null,
				name: null,
				embedded: 0,
				waiting: 1,
				failed: 0,
			},
		]);
	},
	TIMEOUT,
);

test(
	"a reconciler ending a rebuild leaves the flag of a generation started meanwhile",
	async () => {
		const index = indexes.racingFlag;
		const link = await seed();
		await configure(index, link);
		await on(index, link, reconcileEmbeddings);
		await settle(link, "completed");
		const generation = Number(await generationOf(index, link));
		expect(await rebuildFlagOf(index)).toBe(true);

		// Another save holds the settings row while the reconciler ends the rebuild.
		const locked = Promise.withResolvers<void>();
		const release = Promise.withResolvers<void>();
		const saving = runtime.runPromise(
			Effect.gen(function* () {
				const db = yield* DB;
				yield* db.transaction(() =>
					Effect.gen(function* () {
						yield* db.select().from(index.settings).for("update");
						locked.resolve();
						yield* Effect.promise(() => release.promise);
						yield* db
							.update(index.settings)
							.set({
								embeddingGeneration: generation + 1_000_000,
								embeddingRebuilding: true,
							})
							.where(eq(index.settings.id, true));
					}),
				);
			}),
		);
		await locked.promise;
		const reconciling = on(index, link, reconcileEmbeddings);
		await runtime.runPromise(
			awaitLockWaiters("%update%instance_settings%embedding_rebuilding%"),
		);
		release.resolve();
		await saving;
		await reconciling;

		expect(await rebuildFlagOf(index)).toBe(true);
	},
	TIMEOUT,
);

/** Links the asset to one more fresh repository. */
const linkAgain = (link: Link): Promise<Link> =>
	runtime.runPromise(
		Effect.gen(function* () {
			const db = yield* DB;
			const user = yield* createUser();
			const [block] = yield* db
				.insert(dbSchema.block)
				.values({
					type: "repository",
					name: "Second repository",
					config: defaultRepositoryConfig,
					userId: user.id,
				})
				.returning();
			yield* db.insert(dbSchema.blockAsset).values({
				blockId: block.id,
				assetId: link.assetId,
			});
			return {
				assetId: link.assetId,
				blockId: block.id as BlockId,
			};
		}),
	);

/** The asset's processing as stored, and its queued processing jobs. */
const processingOf = (link: Link) =>
	runtime.runPromise(
		Effect.gen(function* () {
			const { asset } = dbSchema;
			const [row] = yield* (yield* DB)
				.select({
					status: asset.processingStatus,
					generation: asset.processingGeneration,
				})
				.from(asset)
				.where(eq(asset.id, link.assetId));
			const { boss } = yield* PgBossService;
			const jobs = yield* Effect.promise(() =>
				boss.findJobs<ProcessAssetPayload>(PROCESS_ASSET_JOB_NAME, {
					data: {
						assetRef: {
							id: link.assetId,
						},
					},
				}),
			);
			return {
				...row,
				jobs: jobs.length,
			};
		}),
	);

test(
	"Prepare again queues each asset missing its stored extraction in the active generation once, also under a double click, and indexes it again in every repository",
	async () => {
		const index = indexes.preparedAgain;
		const missing = await seed();
		const embeddedElsewhere = await linkAgain(missing);
		const other = await seed();
		const earlier = await seed();
		const links = [
			missing,
			embeddedElsewhere,
			other,
			earlier,
		];
		await configure(index, links);
		await on(index, links, reconcileEmbeddings);
		await settle(missing, "failed", "missing_extraction");
		await settle(embeddedElsewhere, "completed");
		await settle(other, "failed", "other");
		await settle(earlier, "failed", "missing_extraction");
		// A failure of another generation is not this one's.
		await runtime.runPromise(
			Effect.gen(function* () {
				const { blockAsset } = dbSchema;
				yield* (yield* DB)
					.update(blockAsset)
					.set({
						embeddingGeneration: null,
					})
					.where(
						and(
							eq(blockAsset.assetId, earlier.assetId),
							eq(blockAsset.blockId, earlier.blockId),
						),
					);
			}),
		);
		expect((await on(index, links, embeddingProgress))?.preparable).toBe(1);
		const before = await Promise.all(links.map(processingOf));

		const userId = await admin();
		await on(index, links, startPreparingMissingExtractionsAgain(userId));
		const job = await takePreparation();
		const queued = await Promise.all([
			on(index, links, prepareMissingExtractionsAgain(job.data)),
			on(index, links, prepareMissingExtractionsAgain(job.data)),
		]);
		await boss.complete(PREPARE_MISSING_EXTRACTIONS_AGAIN_JOB_NAME, job.id);
		expect(queued[0] + queued[1]).toBe(1);
		expect(await membersOf(job.data.runId)).toEqual([
			{
				assetId: missing.assetId,
				blockId: null,
				processing: "pending",
				indexing: null,
			},
		]);
		expect(await leasesOf(job.data.runId)).toBe(0);

		expect(await processingOf(missing)).toEqual({
			status: "pending",
			generation: Number(before[0]?.generation) + 1,
			jobs: 1,
		});
		for (const link of [
			missing,
			embeddedElsewhere,
		]) {
			expect(await linkOf(link)).toMatchObject({
				status: "pending",
				failure: null,
			});
		}
		expect(await processingOf(other)).toEqual(before[2]);
		expect(await processingOf(earlier)).toEqual(before[3]);
		expect(
			await on(index, links, prepareMissingExtractionsAgain(job.data)),
		).toBe(0);
		expect((await on(index, links, embeddingProgress))?.preparable).toBe(0);
	},
	TIMEOUT,
);

test(
	"Prepare again read before a switch queues nothing once the switch lands",
	async () => {
		const index = indexes.preparedWhileSwitching;
		const link = await seed();
		await configure(index, link);
		await on(index, link, reconcileEmbeddings);
		await settle(link, "failed", "missing_extraction");
		const before = await processingOf(link);
		await on(index, link, startPreparingMissingExtractionsAgain(await admin()));
		const job = await takePreparation();

		// The switch holds the generation lock until its collection exists.
		const hold = holdCollections();
		const switching = configure(index, link, "integration-switched");
		await hold.reached(switching);
		const preparing = on(index, link, prepareMissingExtractionsAgain(job.data));
		await runtime.runPromise(
			awaitLockWaiters("%pg_advisory_xact_lock_shared%"),
		);
		hold.release();
		await switching;

		expect(await preparing).toBe(0);
		await boss.complete(PREPARE_MISSING_EXTRACTIONS_AGAIN_JOB_NAME, job.id);
		expect(await processingOf(link)).toEqual(before);
		expect(await linkOf(link)).toMatchObject({
			status: "failed",
			failure: "missing_extraction",
		});
	},
	TIMEOUT,
);

test(
	"Prepare again starts in the background: the request queues one job and no asset, a second request while it waits adds none, the job queues the asset once also when retried, search keeps the asset where it was embedded, and its links wait while it is prepared, also across a model change",
	async () => {
		const index = indexes.preparedInBackground;
		const missing = await seed();
		const embeddedElsewhere = await linkAgain(missing);
		const links = [
			missing,
			embeddedElsewhere,
		];
		await configure(index, links);
		const settings = await on(index, links, embeddingSettings);
		await on(index, links, reconcileEmbeddings);
		const [job] = await jobsOf(embeddedElsewhere);
		if (job) await vectorize(index, links, job);
		await settle(missing, "failed", "missing_extraction");
		const served = await servedPointsOf(
			String(settings?.collection),
			embeddedElsewhere,
		);
		expect(served).toBeGreaterThan(0);
		const before = await processingOf(missing);

		const queuedJobs = async () =>
			(
				await boss.findJobs(PREPARE_MISSING_EXTRACTIONS_AGAIN_JOB_NAME, {
					queued: true,
				})
			).length;

		const userId = await admin();
		const started = await on(
			index,
			links,
			startPreparingMissingExtractionsAgain(userId),
		);
		expect(started).toMatchObject({
			assets: 1,
			joined: false,
		});
		expect(await processingOf(missing)).toEqual(before);
		expect(await queuedJobs()).toBe(1);
		expect(
			await on(index, links, startPreparingMissingExtractionsAgain(userId)),
		).toEqual({
			...started,
			joined: true,
		});
		expect(await queuedJobs()).toBe(1);

		const worker = assetWorkers.find(
			({ queue }) => queue === PREPARE_MISSING_EXTRACTIONS_AGAIN_JOB_NAME,
		);
		// The worker takes the job, and its handler runs again on a retry.
		const [taken] = await boss.fetch(
			PREPARE_MISSING_EXTRACTIONS_AGAIN_JOB_NAME,
		);
		await on(index, links, worker?.handler(taken as never) ?? Effect.void);
		await on(index, links, worker?.handler(taken as never) ?? Effect.void);
		await boss.complete(PREPARE_MISSING_EXTRACTIONS_AGAIN_JOB_NAME, taken.id);
		expect(await processingOf(missing)).toEqual({
			status: "pending",
			generation: Number(before.generation) + 1,
			jobs: 1,
		});
		expect(await linkOf(embeddedElsewhere)).toMatchObject({
			status: "pending",
		});
		expect(
			await servedPointsOf(String(settings?.collection), embeddedElsewhere),
		).toBe(served);

		// Preparing, both links wait, so the counts keep refreshing until they settle.
		const counts = async () => {
			const progress = await on(index, links, embeddingProgress);
			const sum = (key: "embedded" | "waiting" | "failed") =>
				progress?.organizations.reduce((total, row) => total + row[key], 0);
			return {
				embedded: sum("embedded"),
				waiting: sum("waiting"),
				failed: sum("failed"),
				preparable: progress?.preparable,
			};
		};
		const preparing = {
			embedded: 0,
			waiting: 2,
			failed: 0,
			preparable: 0,
		};
		expect(await counts()).toEqual(preparing);
		const processing = (status: "active" | "failed") =>
			runtime.runPromise(
				Effect.gen(function* () {
					const { asset } = dbSchema;
					yield* (yield* DB)
						.update(asset)
						.set({
							processingStatus: status,
						})
						.where(eq(asset.id, missing.assetId));
				}),
			);
		await processing("active");
		expect(await counts()).toEqual(preparing);
		// A model change meanwhile: its processing indexes the links in the new generation.
		await configure(index, links, "integration-switched-while-preparing");
		expect(await counts()).toEqual(preparing);
		expect(await on(index, links, embeddingsRebuilding)).toBe(true);
		// A failed preparation stays with the asset's processing failure.
		await processing("failed");
		expect(await counts()).toEqual({
			embedded: 0,
			waiting: 0,
			failed: 0,
			preparable: 0,
		});
		expect(await on(index, links, embeddingsRebuilding)).toBe(false);

		// The run's member still waits, so a request joins the run and queues nothing.
		expect(
			await on(index, links, startPreparingMissingExtractionsAgain(userId)),
		).toEqual({
			assets: 0,
			runId: started.runId,
			joined: true,
		});
		expect(await queuedJobs()).toBe(0);
	},
	TIMEOUT,
);

test(
	"simultaneous requests to prepare again join one run: one job waits for both, and a request while it runs queues it once more for the same run",
	async () => {
		const index = indexes.preparedTogether;
		const link = await seed();
		await configure(index, link);
		await on(index, link, reconcileEmbeddings);
		await settle(link, "failed", "missing_extraction");
		const [first, second] = await Promise.all([
			admin(),
			admin(),
		]);

		const requests = await Promise.all([
			on(index, link, startPreparingMissingExtractionsAgain(first)),
			on(index, link, startPreparingMissingExtractionsAgain(second)),
		]);
		const runId = requests[0].runId;
		expect(runId).not.toBeNull();
		expect(requests.map((request) => request.runId)).toEqual([
			runId,
			runId,
		]);
		expect(requests.map((request) => request.joined).sort()).toEqual([
			false,
			true,
		]);
		expect(await leasesOf(runId as ActivityRunId)).toBe(1);

		const running = await takePreparation();
		expect(running.data.runId).toBe(runId as ActivityRunId);
		const joined = await on(
			index,
			link,
			startPreparingMissingExtractionsAgain(second),
		);
		expect(joined).toMatchObject({
			runId,
			joined: true,
		});
		// A stately queue hands out the next job once the running one is done.
		const [waiting] =
			await boss.findJobs<PrepareMissingExtractionsAgainPayload>(
				PREPARE_MISSING_EXTRACTIONS_AGAIN_JOB_NAME,
				{
					queued: true,
				},
			);
		expect(waiting?.data.runId).toBe(runId as ActivityRunId);
		expect(await leasesOf(runId as ActivityRunId)).toBe(2);

		expect(
			await on(index, link, prepareMissingExtractionsAgain(running.data)),
		).toBe(1);
		await boss.complete(PREPARE_MISSING_EXTRACTIONS_AGAIN_JOB_NAME, running.id);
		const again = await takePreparation();
		expect(again.id).toBe(waiting?.id as string);
		expect(
			await on(index, link, prepareMissingExtractionsAgain(again.data)),
		).toBe(0);
		await boss.complete(PREPARE_MISSING_EXTRACTIONS_AGAIN_JOB_NAME, again.id);
		expect(await leasesOf(runId as ActivityRunId)).toBe(0);
		expect(await membersOf(runId as ActivityRunId)).toEqual([
			{
				assetId: link.assetId,
				blockId: null,
				processing: "pending",
				indexing: null,
			},
		]);
	},
	TIMEOUT,
);

test(
	"a request after the job queued the assets joins its run until their preparation is done",
	async () => {
		const index = indexes.preparedJoined;
		const link = await seed();
		await configure(index, link);
		await on(index, link, reconcileEmbeddings);
		await settle(link, "failed", "missing_extraction");
		const [first, second] = await Promise.all([
			admin(),
			admin(),
		]);

		const started = await on(
			index,
			link,
			startPreparingMissingExtractionsAgain(first),
		);
		const job = await takePreparation();
		expect(
			await on(index, link, prepareMissingExtractionsAgain(job.data)),
		).toBe(1);
		await boss.complete(PREPARE_MISSING_EXTRACTIONS_AGAIN_JOB_NAME, job.id);

		// The job is done, the asset still waits for its processing.
		expect(
			await on(index, link, startPreparingMissingExtractionsAgain(second)),
		).toEqual({
			assets: 0,
			runId: started.runId,
			joined: true,
		});

		await runtime.runPromise(
			Effect.gen(function* () {
				const { activityMember } = dbSchema;
				yield* (yield* DB)
					.update(activityMember)
					.set({
						processingState: "completed",
					})
					.where(eq(activityMember.runId, started.runId as ActivityRunId));
			}),
		);
		expect(
			await on(index, link, startPreparingMissingExtractionsAgain(second)),
		).toMatchObject({
			runId: null,
			joined: false,
		});
	},
	TIMEOUT,
);

test(
	"an instance request never joins a person's retry of an asset in no repository",
	async () => {
		const index = indexes.preparedBesidePersonal;
		const link = await seed();
		await configure(index, link);
		await on(index, link, reconcileEmbeddings);
		await settle(link, "failed", "missing_extraction");
		const personal = await runtime.runPromise(
			Effect.gen(function* () {
				const user = yield* createUser();
				const [asset] = yield* (yield* DB)
					.insert(dbSchema.asset)
					.values({
						bucket: buckets.main.name,
						prefix: `users/${user.id}/asset`,
						title: "unlinked.pdf",
						size: 1,
						fileType: "pdf",
						userId: user.id,
						processingStatus: "completed",
					})
					.returning();
				yield* prepareAssetAgain({
					userId: user.id,
					assetId: asset.id,
				});
				const [run] = yield* (yield* DB)
					.select({
						id: dbSchema.activityRun.id,
					})
					.from(dbSchema.activityRun)
					.where(eq(dbSchema.activityRun.userId, user.id));
				return run?.id;
			}),
		);
		expect(personal).toBeDefined();

		// Unscoped like the instance itself, so the person's run is the newest candidate.
		const started = await runtime.runPromise(
			startPreparingMissingExtractionsAgain(await admin()).pipe(
				Effect.provideService(EmbeddingIndex, {
					...index,
					blockIds: undefined,
				}),
			),
		);
		expect(started.runId).not.toBeNull();
		expect(started.runId).not.toBe(personal as ActivityRunId);
		const job = await takePreparation();
		await boss.complete(PREPARE_MISSING_EXTRACTIONS_AGAIN_JOB_NAME, job.id);
	},
	TIMEOUT,
);
