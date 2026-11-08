import { describe, expect, test } from "bun:test";
import type { AssetId, BlockId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { ensureQueues, PgBossService } from "@orcai/pg-boss";
import {
	admit,
	cleanUpDeletions,
	cleanUpDueDeletions,
	type ObservedLink,
	recordDeletion,
	withLinkPoints,
} from "@orcai/preparation";
import {
	EmbeddingGeneration,
	onActiveGeneration,
	QdrantService,
	upsertPointsToQdrant,
	writeGeneration,
} from "@orcai/qdrant";
import { testEmbeddingIndex } from "@orcai/qdrant/testing";
import {
	type PipelineFailure,
	type PipelineStatus,
	VECTORIZE_ASSET_JOB_NAME,
	type VectorizeAssetPayload,
} from "@orcai/schema";
import { NEWEST_REVISION } from "@orcai/spice-db";
import { awaitLockWaiters } from "@orcai/testing";
import { and, eq, sql } from "drizzle-orm";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import { writeRelationships } from "@/lib/authz/relationship-write";
import { deleteResourcesWithAuthorization } from "@/lib/authz/resource-lifecycle";
import { replaceBlockAssets } from "@/lib/blocks/repository";
import { Procedures } from "@/lib/orpc/implementation/procedures";
import {
	type Actor,
	appIntegration,
	TIMEOUT,
} from "@/lib/testing/app-integration";

const dimensions = 4;
// Indexing never embeds here, so the endpoint is never called.
const { run, organizationWith, procedureOptions, createAsset, caller } =
	appIntegration({
		embeddingIndex: await testEmbeddingIndex({
			baseUrl: "http://127.0.0.1:9/v1",
			model: "integration",
			dimensions,
		}),
	});

const repository = (assets: AssetId[]) => ({
	type: "repository" as const,
	name: "Integration repository",
	description: null,
	contentJson: null,
	status: "ready" as const,
	assets,
	config: {
		minPassages: 1,
		maxPassages: 5,
		defaultPassages: 3,
	},
});

const links = (blockId: BlockId) =>
	run(
		Effect.gen(function* () {
			const rows = yield* (yield* DB)
				.select({
					assetId: dbSchema.blockAsset.assetId,
					status: dbSchema.blockAsset.indexStatus,
				})
				.from(dbSchema.blockAsset)
				.where(eq(dbSchema.blockAsset.blockId, blockId));
			return Object.fromEntries(
				rows.map((row) => [
					row.assetId,
					row.status,
				]),
			);
		}),
	);

const setStatus = (params: {
	assetId: AssetId;
	processing?: PipelineStatus;
	index?: {
		blockId: BlockId;
		status: PipelineStatus;
	};
}) =>
	run(
		Effect.gen(function* () {
			const db = yield* DB;
			if (params.processing) {
				yield* db
					.update(dbSchema.asset)
					.set({
						processingStatus: params.processing,
					})
					.where(eq(dbSchema.asset.id, params.assetId));
			}
			if (params.index) {
				yield* db
					.update(dbSchema.blockAsset)
					.set({
						indexStatus: params.index.status,
						indexFailure: params.index.status === "failed" ? "other" : null,
					})
					.where(
						and(
							eq(dbSchema.blockAsset.assetId, params.assetId),
							eq(dbSchema.blockAsset.blockId, params.index.blockId),
						),
					);
			}
		}),
	);

const linkAttempt = (assetId: AssetId, blockId: BlockId) =>
	run(
		Effect.gen(function* () {
			const [row] = yield* (yield* DB)
				.select({
					attempt: dbSchema.blockAsset.indexAttempt,
				})
				.from(dbSchema.blockAsset)
				.where(
					and(
						eq(dbSchema.blockAsset.assetId, assetId),
						eq(dbSchema.blockAsset.blockId, blockId),
					),
				);
			return row?.attempt;
		}),
	);

/** The attempts of the indexing jobs queued for one link. */
const queuedAttempts = (assetId: AssetId, blockId: BlockId) =>
	run(
		Effect.gen(function* () {
			const { boss } = yield* PgBossService;
			const jobs = yield* Effect.promise(() =>
				boss.findJobs<VectorizeAssetPayload>(VECTORIZE_ASSET_JOB_NAME, {
					data: {
						assetId,
						blockId,
					},
				}),
			);
			return jobs.map((job) => job.data.attempt);
		}),
	);

/** A point of the link's `attempt`, as a vectorize delivery writes it. */
const writePoint = (assetId: AssetId, blockId: BlockId, attempt: number) =>
	writeGeneration(
		upsertPointsToQdrant({
			points: [
				{
					id: crypto.randomUUID(),
					vector: Array.from(
						{
							length: dimensions,
						},
						(_, dimension) => (dimension === 0 ? 1 : 0),
					),
					payload: {
						source: "text",
						asset_id: assetId,
						block_id: blockId,
						text: "Refunds rose in February.",
						depth: 0,
						tokens: 5,
						chunk_index: 0,
						chunkCount: 1,
						createdAt: new Date().toISOString(),
						index_attempt: attempt,
						published: false,
					},
				},
			],
		}),
	);

const assetPoints = (assetId: AssetId) => ({
	must: [
		{
			key: "asset_id",
			match: {
				value: assetId,
			},
		},
	],
});

/** The payloads of the asset's points. */
const pointPayloads = (assetId: AssetId) =>
	Effect.gen(function* () {
		const { client } = yield* QdrantService;
		const { collection } = yield* onActiveGeneration(EmbeddingGeneration);
		const { points } = yield* Effect.promise(() =>
			client.scroll(collection, {
				filter: assetPoints(assetId),
				with_payload: true,
			}),
		);
		return points.map((point) => point.payload);
	});

/** The attempts of the asset's remaining points, which it then deletes. */
const takePoints = (assetId: AssetId) =>
	run(
		Effect.gen(function* () {
			const payloads = yield* pointPayloads(assetId);
			const { client } = yield* QdrantService;
			const { collection } = yield* onActiveGeneration(EmbeddingGeneration);
			yield* Effect.promise(() =>
				client.delete(collection, {
					wait: true,
					filter: assetPoints(assetId),
				}),
			);
			return payloads.map((payload) => payload?.index_attempt);
		}),
	);

/** The repositories the asset's points belong to. */
const pointRepositories = async (assetId: AssetId) =>
	(await run(pointPayloads(assetId)))
		.map((payload) => payload?.block_id)
		.sort();

/** A repository of `count` fresh assets, owned by one signed-in editor. */
const repositoryWith = async (count: number) => {
	const {
		organizationId,
		actors: [owner],
	} = await organizationWith([
		"member",
	]);
	const { call, observe, token } = caller();
	const assets: AssetId[] = [];
	for (let index = 0; index < count; index++) {
		const created = await createAsset(owner, organizationId);
		assets.push(created.asset.id);
		observe(created.zedToken);
	}
	const procedures = await run(Procedures);
	const { data } = await call(owner, (options) =>
		procedures.block.create(repository(assets), options),
	);
	return {
		owner,
		organizationId,
		assets,
		blockId: data.id,
		zedToken: token(),
	};
};

/** Starts an indexing attempt on each link still at its observed attempt. */
const indexAgain = (links: readonly ObservedLink[]) =>
	admit({
		stage: "indexing",
		links,
	});

/** Prepares the asset again from its observed generation; whether it was admitted. */
const prepareAgain = async (asset: typeof dbSchema.asset.$inferSelect) =>
	(
		await run(
			admit({
				stage: "processing",
				assets: [
					{
						id: asset.id,
						generation: asset.processingGeneration,
					},
				],
				from: [
					"completed",
					"failed",
				],
			}),
		)
	).length > 0;

describe("repository asset links", () => {
	test(
		"start pending, and an edit keeps the state of the links it keeps",
		async () => {
			const { owner, organizationId, assets, blockId, zedToken } =
				await repositoryWith(2);
			const [kept, removed] = assets;
			expect(await links(blockId)).toEqual({
				[kept]: "pending",
				[removed]: "pending",
			});

			await setStatus({
				assetId: kept,
				index: {
					blockId,
					status: "completed",
				},
			});
			const added = await createAsset(owner, organizationId);
			const procedures = await run(Procedures);
			await run(
				procedures.block.update(
					{
						id: blockId,
						...repository([
							kept,
							added.asset.id,
							added.asset.id,
						]),
					},
					await procedureOptions(owner, added.zedToken ?? zedToken),
				),
			);

			expect(await links(blockId)).toEqual({
				[kept]: "completed",
				[added.asset.id]: "pending",
			});
		},
		TIMEOUT,
	);
});

describe("chat uploads in repositories", () => {
	test(
		"a chat upload is refused until it is added to the Library",
		async () => {
			const {
				owner,
				organizationId,
				assets: [held],
				blockId,
				zedToken,
			} = await repositoryWith(1);
			const upload = await createAsset(owner, organizationId);
			await run(
				Effect.gen(function* () {
					yield* (yield* DB)
						.update(dbSchema.asset)
						.set({
							keptIn: "chat",
						})
						.where(eq(dbSchema.asset.id, upload.asset.id));
				}),
			);
			const procedures = await run(Procedures);
			const link = async () =>
				run(
					procedures.block.update(
						{
							id: blockId,
							...repository([
								held,
								upload.asset.id,
							]),
						},
						await procedureOptions(owner, upload.zedToken ?? zedToken),
					),
				);

			expect(
				await link().then(
					() => undefined,
					(error: unknown) => error,
				),
			).toMatchObject({
				reason: "CHAT_UPLOAD_NOT_IN_LIBRARY",
			});
			expect(await links(blockId)).toEqual({
				[held]: "pending",
			});

			await run(
				procedures.asset.addToLibrary(
					{
						id: upload.asset.id,
					},
					await procedureOptions(owner, upload.zedToken ?? zedToken),
				),
			);
			await link();

			expect(await links(blockId)).toEqual({
				[held]: "pending",
				[upload.asset.id]: "pending",
			});
		},
		TIMEOUT,
	);
});

describe("reset rules", () => {
	test(
		"preparingAgain turns the asset and every link pending, once",
		async () => {
			const { assets, blockId } = await repositoryWith(1);
			const [assetId] = assets;
			await setStatus({
				assetId,
				processing: "failed",
				index: {
					blockId,
					status: "completed",
				},
			});
			const [asset] = await run(
				Effect.gen(function* () {
					return yield* (yield* DB)
						.select()
						.from(dbSchema.asset)
						.where(eq(dbSchema.asset.id, assetId));
				}),
			);

			expect(await prepareAgain(asset)).toBe(true);
			expect(await prepareAgain(asset)).toBe(false);

			const [after] = await run(
				Effect.gen(function* () {
					return yield* (yield* DB)
						.select({
							status: dbSchema.asset.processingStatus,
							failure: dbSchema.asset.processingFailure,
						})
						.from(dbSchema.asset)
						.where(eq(dbSchema.asset.id, assetId));
				}),
			);
			expect(after).toEqual({
				status: "pending",
				failure: null,
			});
			expect(await links(blockId)).toEqual({
				[assetId]: "pending",
			});

			// A request that read the asset before another one admitted it admits nothing.
			await setStatus({
				assetId,
				processing: "failed",
			});
			expect(await prepareAgain(asset)).toBe(false);
		},
		TIMEOUT,
	);

	test(
		"retrying indexing turns only that link pending",
		async () => {
			const { assets, blockId } = await repositoryWith(2);
			const [retried, other] = assets;
			for (const assetId of assets) {
				await setStatus({
					assetId,
					processing: "completed",
					index: {
						blockId,
						status: "failed",
					},
				});
			}

			await run(
				indexAgain([
					{
						assetId: retried,
						blockId,
						attempt: (await linkAttempt(retried, blockId)) ?? -1,
					},
				]),
			);

			expect(await links(blockId)).toEqual({
				[retried]: "pending",
				[other]: "failed",
			});
		},
		TIMEOUT,
	);
});

describe("overlapping admissions", () => {
	test(
		"two retries that read the same failed link admit it once",
		async () => {
			const {
				assets: [assetId],
				blockId,
			} = await repositoryWith(1);
			await setStatus({
				assetId,
				processing: "completed",
				index: {
					blockId,
					status: "failed",
				},
			});
			const observed = {
				assetId,
				blockId,
				attempt: (await linkAttempt(assetId, blockId)) ?? -1,
			};

			const admitted = await Promise.all([
				run(
					indexAgain([
						observed,
					]),
				),
				run(
					indexAgain([
						observed,
					]),
				),
			]);

			expect(admitted.flat()).toHaveLength(1);
			expect(await queuedAttempts(assetId, blockId)).toEqual([
				await linkAttempt(assetId, blockId),
			]);
		},
		TIMEOUT,
	);

	test(
		"unlinking reconciles the link, so a relink's newer points stay",
		async () => {
			const {
				assets: [assetId],
				blockId,
			} = await repositoryWith(1);
			const link = and(
				eq(dbSchema.blockAsset.assetId, assetId),
				eq(dbSchema.blockAsset.blockId, blockId),
			);
			const observedLink = {
				assetId: dbSchema.blockAsset.assetId,
				blockId: dbSchema.blockAsset.blockId,
				attempt: dbSchema.blockAsset.indexAttempt,
			};

			const removed = await run(
				Effect.gen(function* () {
					const db = yield* DB;
					const [before] = yield* db
						.select(observedLink)
						.from(dbSchema.blockAsset)
						.where(link);
					yield* writePoint(assetId, blockId, before.attempt);
					const removed = yield* db
						.delete(dbSchema.blockAsset)
						.where(link)
						.returning(observedLink);
					const [relinked] = yield* db
						.insert(dbSchema.blockAsset)
						.values({
							assetId,
							blockId,
						})
						.returning(observedLink);
					yield* writePoint(assetId, blockId, relinked.attempt);
					return removed;
				}),
			);
			await run(
				recordDeletion({
					indexedLinks: removed,
					files: [],
				}).pipe(
					Effect.flatMap((cleanup) =>
						cleanUpDeletions([
							cleanup,
						]),
					),
				),
			);

			expect(await takePoints(assetId)).toEqual([
				await linkAttempt(assetId, blockId),
			]);
		},
		TIMEOUT,
	);
});

describe("block.readiness", () => {
	test(
		"reports each readable repository's assets and leaves out the rest",
		async () => {
			const { owner, assets, blockId, zedToken } = await repositoryWith(3);
			const [ready, failed] = assets;
			await setStatus({
				assetId: ready,
				processing: "completed",
				index: {
					blockId,
					status: "completed",
				},
			});
			await setStatus({
				assetId: failed,
				processing: "failed",
			});
			const {
				actors: [stranger],
				zedToken: strangerToken,
			} = await organizationWith([
				"member",
			]);
			const procedures = await run(Procedures);
			const readiness = async (actor: Actor, token = zedToken) =>
				(
					await run(
						procedures.block.readiness(
							{
								blockIds: [
									blockId,
								],
							},
							await procedureOptions(actor, token),
						),
					)
				).data;

			const [repository] = await readiness(owner);
			expect(repository.totals).toEqual({
				total: 3,
				ready: 1,
				preparing: 1,
				failed: 1,
			});
			expect(repository.capabilities.edit).toBe(true);
			expect(
				repository.assets.find((asset) => asset.assetId === failed)?.failure,
			).toEqual({
				stage: "processing",
				kind: "other",
			});
			expect(await readiness(stranger, strangerToken)).toEqual([]);
		},
		TIMEOUT,
	);
});

describe("retrying assets", () => {
	test(
		"retries the failed stage where it can help, an unreadable image included, and refuses the rest",
		async () => {
			const { owner, assets, blockId, zedToken } = await repositoryWith(6);
			const [
				processingFailed,
				indexingFailed,
				empty,
				unreadableImage,
				unsupportedDocument,
				preparing,
			] = assets;
			await setStatus({
				assetId: processingFailed,
				processing: "failed",
			});
			await setStatus({
				assetId: indexingFailed,
				processing: "completed",
				index: {
					blockId,
					status: "failed",
				},
			});
			const failProcessing = (
				assetId: AssetId,
				failure: PipelineFailure,
				fileType: "pdf" | "png" | "docx",
			) =>
				run(
					Effect.gen(function* () {
						yield* (yield* DB)
							.update(dbSchema.asset)
							.set({
								processingStatus: "failed",
								processingFailure: failure,
								fileType,
							})
							.where(eq(dbSchema.asset.id, assetId));
					}),
				);
			await failProcessing(empty, "empty", "pdf");
			await failProcessing(unreadableImage, "unsupported", "png");
			await failProcessing(unsupportedDocument, "unsupported", "docx");
			const procedures = await run(Procedures);
			const options = await procedureOptions(owner, zedToken);

			expect(
				await run(
					procedures.block.prepareFailedAgain(
						{
							blockId,
						},
						options,
					),
				),
			).toEqual({
				processing: 2,
				indexing: 1,
			});
			expect(await links(blockId)).toMatchObject({
				[processingFailed]: "pending",
				[indexingFailed]: "pending",
				[unreadableImage]: "pending",
			});
			expect(
				(
					await run(
						procedures.block.readiness(
							{
								blockIds: [
									blockId,
								],
							},
							options,
						),
					)
				).data[0].totals,
			).toEqual({
				total: 6,
				ready: 0,
				preparing: 4,
				failed: 2,
			});

			await expect(
				run(
					procedures.block.prepareAssetAgain(
						{
							blockId,
							assetId: empty,
						},
						options,
					),
				),
			).rejects.toMatchObject({
				reason: "ASSET_PREPARING_AGAIN_UNHELPFUL",
			});
			await expect(
				run(
					procedures.block.prepareAssetAgain(
						{
							blockId,
							assetId: preparing,
						},
						options,
					),
				),
			).rejects.toMatchObject({
				reason: "ASSET_STILL_PREPARING",
			});
		},
		TIMEOUT,
	);
});

describe("retrying an asset whose stored extraction is gone", () => {
	test(
		"prepares the file again, since indexing would read the same missing extraction",
		async () => {
			const { owner, assets, blockId, zedToken } = await repositoryWith(2);
			for (const assetId of assets) {
				await setStatus({
					assetId,
					processing: "completed",
					index: {
						blockId,
						status: "failed",
					},
				});
			}
			await run(
				Effect.gen(function* () {
					yield* (yield* DB)
						.update(dbSchema.blockAsset)
						.set({
							indexFailure: "missing_extraction",
						})
						.where(eq(dbSchema.blockAsset.blockId, blockId));
				}),
			);
			const procedures = await run(Procedures);
			const options = await procedureOptions(owner, zedToken);
			const [one, other] = assets;

			expect(
				await run(
					procedures.block.prepareAssetAgain(
						{
							blockId,
							assetId: one,
						},
						options,
					),
				),
			).toEqual({
				retried: "processing",
			});
			expect(
				await run(
					procedures.block.prepareFailedAgain(
						{
							blockId,
						},
						options,
					),
				),
			).toEqual({
				processing: 1,
				indexing: 0,
			});
			const processing = await run(
				Effect.gen(function* () {
					return yield* (yield* DB)
						.select({
							status: dbSchema.asset.processingStatus,
						})
						.from(dbSchema.asset)
						.where(eq(dbSchema.asset.id, other));
				}),
			);
			expect(processing).toEqual([
				{
					status: "pending",
				},
			]);
			// Processing queues indexing again once it stored a new extraction.
			expect(await links(blockId)).toEqual({
				[one]: "pending",
				[other]: "pending",
			});
		},
		TIMEOUT,
	);
});

describe("attaching while processing completes", () => {
	test(
		"an asset completing as it is attached is queued for indexing in the new repository",
		async () => {
			const {
				owner,
				organizationId,
				blockId,
				assets,
				zedToken: repoToken,
			} = await repositoryWith(1);
			const { asset, zedToken } = await createAsset(owner, organizationId);
			const assetId = asset.id as AssetId;
			await run(
				Effect.gen(function* () {
					yield* (yield* DB)
						.update(dbSchema.asset)
						.set({
							processingStatus: "active",
						})
						.where(eq(dbSchema.asset.id, assetId));
				}),
			);
			const linksRead = await run(Deferred.make<void>());
			const commit = await run(Deferred.make<void>());

			// Processing has completed the asset and read its links, but not committed.
			const processing = await run(
				Effect.forkDetach(
					Effect.gen(function* () {
						const db = yield* DB;
						yield* db.transaction(() =>
							Effect.gen(function* () {
								yield* db
									.update(dbSchema.asset)
									.set({
										processingStatus: "completed",
									})
									.where(eq(dbSchema.asset.id, assetId));
								yield* db
									.select({
										blockId: dbSchema.blockAsset.blockId,
									})
									.from(dbSchema.blockAsset)
									.where(eq(dbSchema.blockAsset.assetId, assetId));
								yield* Deferred.succeed(linksRead, undefined);
								yield* Deferred.await(commit);
							}),
						);
					}),
				),
			);
			await run(Deferred.await(linksRead));

			const procedures = await run(Procedures);
			const options = await procedureOptions(owner, zedToken ?? repoToken);
			const attach = await run(
				Effect.forkDetach(
					procedures.block.update(
						{
							id: blockId,
							...repository([
								...assets,
								assetId,
							]),
						},
						options,
					),
				),
			);
			await run(awaitLockWaiters("%for share%"));
			await run(Deferred.succeed(commit, undefined));
			await run(Fiber.join(processing));
			await run(Fiber.join(attach));

			expect(await queuedAttempts(assetId, blockId)).toEqual([
				await linkAttempt(assetId, blockId),
			]);
		},
		TIMEOUT,
	);
});

describe("saving a repository and processing completing", () => {
	/** What processing does once its attempt completed: the asset, then indexing of every link. */
	const completeProcessing = (assetId: AssetId) =>
		run(
			Effect.gen(function* () {
				const db = yield* DB;
				yield* db.transaction(() =>
					Effect.gen(function* () {
						yield* db
							.update(dbSchema.asset)
							.set({
								processingStatus: "completed",
							})
							.where(eq(dbSchema.asset.id, assetId));
						yield* admit({
							stage: "indexing",
							links: yield* db
								.select({
									assetId: dbSchema.blockAsset.assetId,
									blockId: dbSchema.blockAsset.blockId,
									attempt: dbSchema.blockAsset.indexAttempt,
								})
								.from(dbSchema.blockAsset)
								.where(eq(dbSchema.blockAsset.assetId, assetId)),
						});
					}),
				);
			}),
		);

	test(
		"an asset saved before its processing completes is queued once, by the completion",
		async () => {
			const {
				assets: [assetId],
				blockId,
			} = await repositoryWith(1);
			expect(await queuedAttempts(assetId, blockId)).toEqual([]);

			await completeProcessing(assetId);
			expect(await queuedAttempts(assetId, blockId)).toEqual([
				await linkAttempt(assetId, blockId),
			]);
		},
		TIMEOUT,
	);

	test(
		"an asset saved after its processing completed is queued once, by the save",
		async () => {
			const repo = await repositoryWith(1);
			const { asset, zedToken } = await createAsset(
				repo.owner,
				repo.organizationId,
			);
			const assetId = asset.id as AssetId;

			await completeProcessing(assetId);
			const procedures = await run(Procedures);
			await run(
				procedures.block.update(
					{
						id: repo.blockId,
						...repository([
							...repo.assets,
							assetId,
						]),
					},
					await procedureOptions(repo.owner, zedToken ?? repo.zedToken),
				),
			);
			expect(await queuedAttempts(assetId, repo.blockId)).toEqual([
				await linkAttempt(assetId, repo.blockId),
			]);
		},
		TIMEOUT,
	);
});

describe("saving a repository whose indexing cannot be queued", () => {
	test(
		"the save links nothing, so saving again links the asset and queues its indexing",
		async () => {
			const repo = await repositoryWith(1);
			const { asset, zedToken } = await createAsset(
				repo.owner,
				repo.organizationId,
			);
			const assetId = asset.id as AssetId;
			await setStatus({
				assetId,
				processing: "completed",
			});
			const procedures = await run(Procedures);
			const options = await procedureOptions(
				repo.owner,
				zedToken ?? repo.zedToken,
			);
			const save = () =>
				run(
					procedures.block.update(
						{
							id: repo.blockId,
							...repository([
								...repo.assets,
								assetId,
							]),
						},
						options,
					),
				);
			const boss = await run(PgBossService.useSync(({ boss }) => boss));

			await boss.deleteQueue(VECTORIZE_ASSET_JOB_NAME);
			try {
				await expect(save()).rejects.toBeDefined();
			} finally {
				await run(
					ensureQueues([
						VECTORIZE_ASSET_JOB_NAME,
					]),
				);
			}
			expect(await links(repo.blockId)).not.toHaveProperty(assetId);

			await save();
			expect(await queuedAttempts(assetId, repo.blockId)).toEqual([
				await linkAttempt(assetId, repo.blockId),
			]);
		},
		TIMEOUT,
	);
});

describe("deleting a linked asset or repository", () => {
	for (const resourceType of [
		"asset",
		"block",
	] as const) {
		test(
			`deleting the ${resourceType} removes a point written under the link lock while it ran`,
			async () => {
				const {
					owner,
					assets: [assetId],
					blockId,
				} = await repositoryWith(1);
				const attempt = (await linkAttempt(assetId, blockId)) ?? 0;
				const locked = await run(Deferred.make<void>());
				const release = await run(Deferred.make<void>());
				// A vectorize delivery that passed its check under the lock and has yet to upsert.
				const staging = await run(
					Effect.forkDetach(
						withLinkPoints(
							{
								assetId,
								blockId,
							},
							Effect.gen(function* () {
								yield* Deferred.succeed(locked, undefined);
								yield* Deferred.await(release);
								yield* writePoint(assetId, blockId, attempt);
							}),
						),
					),
				);
				await run(Deferred.await(locked));

				const deleting = await run(
					Effect.forkDetach(
						deleteResourcesWithAuthorization({
							resourceType,
							resourceIds: [
								resourceType === "asset" ? assetId : blockId,
							],
							actor: {
								userId: owner.user.id,
								zedToken: NEWEST_REVISION,
							},
						}),
					),
				);
				await run(awaitLockWaiters("%pg_advisory_xact_lock%"));
				await run(Deferred.succeed(release, undefined));
				await run(Fiber.join(staging));
				await run(Fiber.join(deleting));

				expect(await takePoints(assetId)).toEqual([]);
			},
			TIMEOUT,
		);
	}

	test(
		"deleting a repository while Qdrant is down removes only its points once Qdrant is back",
		async () => {
			const {
				owner,
				assets: [assetId],
				blockId,
				zedToken,
			} = await repositoryWith(1);
			const procedures = await run(Procedures);
			const { call } = caller(zedToken);
			const { data: kept } = await call(owner, (options) =>
				procedures.block.create(
					repository([
						assetId,
					]),
					options,
				),
			);
			for (const repositoryId of [
				blockId,
				kept.id,
			])
				await run(
					writePoint(
						assetId,
						repositoryId,
						(await linkAttempt(assetId, repositoryId)) ?? 0,
					),
				);
			const qdrant = await run(QdrantService);
			const unavailable = {
				...qdrant,
				client: new Proxy(qdrant.client, {
					get(target, key) {
						const value = Reflect.get(target, key);
						return typeof value === "function"
							? () => Promise.reject(new Error("injected Qdrant outage"))
							: value;
					},
				}),
			};

			await run(
				deleteResourcesWithAuthorization({
					resourceType: "block",
					resourceIds: [
						blockId,
					],
					actor: {
						userId: owner.user.id,
						zedToken: NEWEST_REVISION,
					},
				}).pipe(Effect.provideService(QdrantService, unavailable)),
			);
			expect(await pointRepositories(assetId)).toEqual(
				[
					blockId,
					kept.id,
				].sort(),
			);

			await run(
				Effect.gen(function* () {
					yield* (yield* DB)
						.update(dbSchema.deletionCleanup)
						.set({
							nextAttemptAt: new Date(0),
						})
						.where(
							sql`${dbSchema.deletionCleanup.data} -> 'indexedLinks' @> ${JSON.stringify(
								[
									{
										blockId,
									},
								],
							)}::jsonb`,
						);
					yield* cleanUpDueDeletions;
				}),
			);

			expect(await pointRepositories(assetId)).toEqual([
				kept.id,
			]);
			expect(await links(kept.id)).toHaveProperty(assetId);
			await takePoints(assetId);
		},
		TIMEOUT,
	);
});

describe("unlinking many assets", () => {
	test(
		"removes every link's points, at most five links at a time, so other requests still get a connection",
		async () => {
			const { owner, organizationId, assets, blockId } =
				await repositoryWith(30);
			for (const assetId of assets)
				await run(
					writePoint(
						assetId,
						blockId,
						(await linkAttempt(assetId, blockId)) ?? 0,
					),
				);
			const qdrant = await run(QdrantService);
			const saturated = await run(Deferred.make<void>());
			const release = await run(Deferred.make<void>());
			let inFlight = 0;
			let mostInFlight = 0;
			const deletes: Promise<unknown>[] = [];
			const held = {
				...qdrant,
				client: new Proxy(qdrant.client, {
					get(target, key) {
						const value = Reflect.get(target, key);
						if (key !== "delete" || typeof value !== "function") return value;
						return (...args: unknown[]) => {
							const call = (async () => {
								inFlight++;
								mostInFlight = Math.max(mostInFlight, inFlight);
								if (inFlight === 5)
									await run(Deferred.succeed(saturated, undefined));
								await run(Deferred.await(release));
								try {
									return await value.apply(target, args);
								} finally {
									inFlight--;
								}
							})();
							deletes.push(call);
							return call;
						};
					},
				}),
			};
			const { result: cleanup } = await run(
				writeRelationships(
					{
						organizationIds: [
							organizationId,
						],
					},
					replaceBlockAssets({
						blockId,
						assetIds: [],
						userId: owner.user.id,
						uploadRunIds: [],
					}),
				),
			);

			const unlinking = await run(
				Effect.forkDetach(
					cleanUpDeletions([
						cleanup,
					]).pipe(Effect.provideService(QdrantService, held)),
				),
			);
			// Another request's read, while the unlinking holds its transactions.
			let read: Promise<unknown> | undefined;
			try {
				await run(Deferred.await(saturated).pipe(Effect.timeout("10 seconds")));
				read = links(blockId);
				expect(
					await run(
						Effect.promise(() => read as Promise<unknown>).pipe(
							Effect.timeout("10 seconds"),
						),
					),
				).toEqual({});
				expect(inFlight).toBe(5);
			} finally {
				await run(Deferred.succeed(release, undefined));
				await run(Fiber.join(unlinking));
				await Promise.allSettled([
					read,
					...deletes,
				]);
			}

			expect(mostInFlight).toBe(5);
			for (const assetId of assets)
				expect(await pointRepositories(assetId)).toEqual([]);
		},
		TIMEOUT,
	);
});
