import { describe, expect, test } from "bun:test";
import { PgClient } from "@effect/sql-pg";
import type { AssetId, BlockId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { PgBossService } from "@orcai/pg-boss";
import { type PipelineStatus, VECTORIZE_ASSET_JOB_NAME } from "@orcai/schema";
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
import {
	enqueueIndexing,
	reindexBlockAssets,
} from "@/lib/blocks/database-block";
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
				enqueueIndexing({
					blockId,
					assetIds: [
						retried,
					],
				}),
			);

			expect(await links(blockId)).toEqual({
				[retried]: "pending",
				[other]: "failed",
			});
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

			await run(
				Effect.gen(function* () {
					yield* (yield* DB).insert(dbSchema.blockAsset).values({
						blockId,
						assetId,
					});
				}),
			);
			const attach = await run(
				Effect.forkDetach(
					reindexBlockAssets({
						blockId,
						addedIds: [
							assetId,
						],
						removedIds: [],
					}),
				),
			);
			await run(
				Effect.gen(function* () {
					const sql = yield* PgClient.PgClient;
					for (;;) {
						const [waiting] = yield* sql<{
							count: number;
						}>`SELECT count(*)::int AS count FROM pg_stat_activity WHERE wait_event_type = 'Lock' AND query ILIKE ${"%for share%"}`;
						if ((waiting?.count ?? 0) > 0) return;
						yield* Effect.sleep("25 millis");
					}
				}),
			);
			await run(Deferred.succeed(commit, undefined));
			await run(Fiber.join(processing));
			await run(Fiber.join(attach));

			const queued = await run(
				Effect.gen(function* () {
					const { boss } = yield* PgBossService;
					return yield* Effect.promise(() =>
						boss.findJobs(VECTORIZE_ASSET_JOB_NAME, {
							data: {
								assetId,
								blockId,
							},
						}),
					);
				}),
			);
			expect(queued).toHaveLength(1);
		},
		TIMEOUT,
	);
});
