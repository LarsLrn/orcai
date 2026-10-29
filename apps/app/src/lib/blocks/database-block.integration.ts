import { describe, expect, test } from "bun:test";
import type { AssetId, BlockId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { PgBossService, queueIndexing, withLinkPoints } from "@orcai/pg-boss";
import {
	deletePointsByIdentifier,
	QdrantService,
	upsertPointsToQdrant,
} from "@orcai/qdrant";
import {
	type PipelineStatus,
	VECTORIZE_ASSET_JOB_NAME,
	type VectorizeAssetPayload,
} from "@orcai/schema";
import { awaitLockWaiters } from "@orcai/testing";
import { and, eq } from "drizzle-orm";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import { reprocessAsset } from "@/lib/assets/processing";
import {
	type Actor,
	authzIntegration,
	TIMEOUT,
} from "@/lib/authz/authz-integration";
import { deleteResourcesWithAuthorization } from "@/lib/authz/resource-lifecycle";
import { reindexBlockAssets } from "@/lib/blocks/database-block";
import { Procedures } from "@/lib/orpc/implementation/procedures";

const { run, organizationWith, procedureOptions, createAsset } =
	authzIntegration();

const repository = (assets: AssetId[]) => ({
	type: "database" as const,
	name: "Integration repository",
	description: null,
	contentJson: null,
	contentHtml: null,
	status: "ready" as const,
	assets,
	config: {
		minReferences: 1,
		maxReferences: 5,
		defaultReferences: 3,
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
	Effect.gen(function* () {
		const { collections } = yield* QdrantService;
		yield* upsertPointsToQdrant({
			points: [
				{
					id: crypto.randomUUID(),
					vector: Array.from(
						{
							length: collections.asset.dimensions,
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
					},
				},
			],
		});
	});

/** The attempts of the asset's remaining points, which it then deletes. */
const takePoints = (assetId: AssetId) =>
	run(
		Effect.gen(function* () {
			const { client, collections } = yield* QdrantService;
			const { points } = yield* Effect.promise(() =>
				client.scroll(collections.asset.name, {
					filter: {
						must: [
							{
								key: "asset_id",
								match: {
									value: assetId,
								},
							},
						],
					},
					with_payload: true,
				}),
			);
			yield* deletePointsByIdentifier({
				assetId,
				blockId: undefined,
			});
			return points.map((point) => point.payload?.index_attempt);
		}),
	);

/** A repository of `count` fresh assets, owned by one signed-in editor. */
const repositoryWith = async (count: number) => {
	const {
		organizationId,
		actors: [owner],
	} = await organizationWith([
		"member",
	]);
	let zedToken: string | undefined;
	const assets: AssetId[] = [];
	for (let index = 0; index < count; index++) {
		const created = await createAsset(owner, organizationId);
		assets.push(created.asset.id);
		zedToken = created.zedToken ?? zedToken;
	}
	const procedures = await run(Procedures);
	const { data, meta } = await run(
		procedures.block.create(
			repository(assets),
			await procedureOptions(owner, zedToken),
		),
	);
	return {
		owner,
		organizationId,
		assets,
		blockId: data.id,
		zedToken: meta?.zedToken ?? zedToken,
	};
};

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

describe("reset rules", () => {
	test(
		"reprocessing turns the asset and every link pending, once",
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

			expect(await run(reprocessAsset(asset))).toBe(true);
			expect(await run(reprocessAsset(asset))).toBe(false);

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
			expect(await run(reprocessAsset(asset))).toBe(false);
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
				queueIndexing([
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
					queueIndexing([
						observed,
					]),
				),
				run(
					queueIndexing([
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
				reindexBlockAssets({
					added: [],
					removed,
				}),
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
		"reports each readable repository's documents and leaves out the rest",
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
			} = await organizationWith([
				"member",
			]);
			const procedures = await run(Procedures);
			const readiness = async (actor: Actor) =>
				(
					await run(
						procedures.block.readiness(
							{
								blockIds: [
									blockId,
								],
							},
							await procedureOptions(actor, zedToken),
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
				repository.documents.find((document) => document.assetId === failed)
					?.failure,
			).toEqual({
				stage: "processing",
				kind: "other",
			});
			expect(await readiness(stranger)).toEqual([]);
		},
		TIMEOUT,
	);
});

describe("retrying documents", () => {
	test(
		"retries the failed stage, skips failures retrying cannot fix, and refuses documents still preparing",
		async () => {
			const { owner, assets, blockId, zedToken } = await repositoryWith(4);
			const [processingFailed, indexingFailed, empty, preparing] = assets;
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
			await setStatus({
				assetId: empty,
				processing: "failed",
			});
			await run(
				Effect.gen(function* () {
					yield* (yield* DB)
						.update(dbSchema.asset)
						.set({
							processingFailure: "empty",
						})
						.where(eq(dbSchema.asset.id, empty));
				}),
			);
			const procedures = await run(Procedures);
			const options = await procedureOptions(owner, zedToken);

			expect(
				await run(
					procedures.block.retryFailed(
						{
							blockId,
						},
						options,
					),
				),
			).toEqual({
				processing: 1,
				indexing: 1,
			});
			expect(await links(blockId)).toMatchObject({
				[processingFailed]: "pending",
				[indexingFailed]: "pending",
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
				total: 4,
				ready: 0,
				preparing: 3,
				failed: 1,
			});

			expect(
				await run(
					procedures.block.retryDocument(
						{
							blockId,
							assetId: empty,
						},
						options,
					),
				),
			).toEqual({
				retried: "processing",
			});
			await expect(
				run(
					procedures.block.retryDocument(
						{
							blockId,
							assetId: preparing,
						},
						options,
					),
				),
			).rejects.toMatchObject({
				reason: "DOCUMENT_STILL_PREPARING",
			});
		},
		TIMEOUT,
	);
});

describe("attaching while processing completes", () => {
	test(
		"an asset completing as it is attached is queued for indexing in the new repository",
		async () => {
			const { owner, organizationId, blockId } = await repositoryWith(1);
			const { asset } = await createAsset(owner, organizationId);
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

			const added = await run(
				Effect.gen(function* () {
					return yield* (yield* DB)
						.insert(dbSchema.blockAsset)
						.values({
							blockId,
							assetId,
						})
						.returning({
							assetId: dbSchema.blockAsset.assetId,
							blockId: dbSchema.blockAsset.blockId,
							attempt: dbSchema.blockAsset.indexAttempt,
						});
				}),
			);
			const attach = await run(
				Effect.forkDetach(
					reindexBlockAssets({
						added,
						removed: [],
					}),
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
						yield* queueIndexing(
							yield* db
								.select({
									assetId: dbSchema.blockAsset.assetId,
									blockId: dbSchema.blockAsset.blockId,
									attempt: dbSchema.blockAsset.indexAttempt,
								})
								.from(dbSchema.blockAsset)
								.where(eq(dbSchema.blockAsset.assetId, assetId)),
						);
					}),
				);
			}),
		);

	test(
		"a document saved before its processing completes is queued once, by the completion",
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
		"a document saved after its processing completed is queued once, by the save",
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

describe("deleting a linked document or repository", () => {
	for (const resourceType of [
		"asset",
		"block",
	] as const) {
		test(
			`deleting the ${resourceType} removes a point written under the link lock while it ran`,
			async () => {
				const {
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
});
