import type { AssetId, BlockId, OrganizationId, UserId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { sendJobBatch } from "@orcai/pg-boss";
import { deletePointsByIdentifier } from "@orcai/qdrant";
import { VECTORIZE_ASSET_JOB_NAME } from "@orcai/schema";
import { permittedEntityIds } from "@orcai/spice-db";
import { and, eq, getColumns, inArray } from "drizzle-orm";
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import { emptyCapabilities } from "@/lib/authz/capabilities";
import { getManyEntityCapabilities } from "@/lib/authz/entity-capabilities";
import { RelationshipFact } from "@/lib/authz/relationship-facts";
import { recordRelationshipFacts } from "@/lib/authz/relationship-write";
import * as AppErrors from "@/lib/effect/utils/errors";

export const loadDatabaseBlockAssets = (params: {
	blockId: BlockId;
	userId: UserId;
	organizationId: OrganizationId | undefined;
	zedToken?: string;
}) =>
	Effect.gen(function* () {
		const db = yield* DB;

		const assets = yield* db
			.select({
				...getColumns(dbSchema.asset),
			})
			.from(dbSchema.blockAsset)
			.innerJoin(
				dbSchema.asset,
				eq(dbSchema.asset.id, dbSchema.blockAsset.assetId),
			)
			.where(eq(dbSchema.blockAsset.blockId, params.blockId));
		const capabilities = yield* getManyEntityCapabilities({
			entityType: "asset",
			entityIds: assets.map((asset) => asset.id),
			userId: params.userId,
			organizationId: params.organizationId,
			zedToken: params.zedToken,
		});

		return assets.map((asset) => ({
			...asset,
			capabilities: capabilities.get(asset.id) ?? emptyCapabilities("asset"),
		}));
	});

/**
 * Fails unless the user can read every asset, since attaching one to a
 * repository passes read on to the repository's audience. An unknown id is
 * refused the same way, so the answer never tells whether it exists.
 */
export const requireReadableAssets = (params: {
	assetIds: readonly AssetId[];
	userId: UserId;
	zedToken?: string;
}) =>
	Effect.gen(function* () {
		const assetIds = Array.from(new Set(params.assetIds));
		const readableIds = yield* permittedEntityIds({
			entityIds: assetIds,
			entityType: "asset",
			permission: "read",
			userId: params.userId,
			zedToken: params.zedToken,
		});

		if (assetIds.some((assetId) => !readableIds.has(assetId))) {
			return yield* Effect.fail(
				new AppErrors.ForbiddenError({
					reason: "ASSET_LINK_FORBIDDEN",
					message:
						"You do not have access to attach one or more selected assets.",
				}),
			);
		}
	});

/**
 * Replaces a database block's asset links and records the change. Kept links
 * keep their index state; new ones start pending. Call it in
 * `writeRelationships`, then pass the result to {@link reindexBlockAssets}.
 */
export const replaceBlockAssets = (params: {
	blockId: BlockId;
	assetIds: readonly AssetId[];
}) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const assetIds = Arr.dedupe(params.assetIds);

		const previousAssetIds = (yield* db
			.select({
				assetId: dbSchema.blockAsset.assetId,
			})
			.from(dbSchema.blockAsset)
			.where(eq(dbSchema.blockAsset.blockId, params.blockId))).map(
			(link) => link.assetId,
		);
		const addedIds = Arr.difference(assetIds, previousAssetIds);
		const removedIds = Arr.difference(previousAssetIds, assetIds);

		if (removedIds.length > 0) {
			yield* db
				.delete(dbSchema.blockAsset)
				.where(
					and(
						eq(dbSchema.blockAsset.blockId, params.blockId),
						inArray(dbSchema.blockAsset.assetId, removedIds),
					),
				);
		}

		if (addedIds.length > 0) {
			yield* db
				.insert(dbSchema.blockAsset)
				.values(
					addedIds.map((assetId) => ({
						blockId: params.blockId,
						assetId,
					})),
				)
				.onConflictDoNothing();
		}

		yield* recordRelationshipFacts(
			RelationshipFact.BlockAssetsChanged({
				blockId: params.blockId,
				before: previousAssetIds,
				after: assetIds,
			}),
		);

		return {
			blockId: params.blockId,
			addedIds,
			removedIds,
		};
	});

/**
 * Queues indexing of processed assets in one repository and marks their links
 * pending. A failed enqueue marks the links failed, so Retry shows.
 */
export const enqueueIndexing = (params: {
	blockId: BlockId;
	assetIds: readonly AssetId[];
}) =>
	Effect.gen(function* () {
		if (params.assetIds.length === 0) return;
		const db = yield* DB;
		const links = and(
			eq(dbSchema.blockAsset.blockId, params.blockId),
			inArray(dbSchema.blockAsset.assetId, [
				...params.assetIds,
			]),
		);

		yield* db
			.update(dbSchema.blockAsset)
			.set({
				indexStatus: "pending",
				indexFailure: null,
			})
			.where(links);

		yield* sendJobBatch({
			jobName: VECTORIZE_ASSET_JOB_NAME,
			jobs: params.assetIds.map((assetId) => ({
				data: {
					assetId,
					blockId: params.blockId,
				},
			})),
		}).pipe(
			Effect.tapError(() =>
				db
					.update(dbSchema.blockAsset)
					.set({
						indexStatus: "failed",
						indexFailure: "other",
					})
					.where(links),
			),
		);
	});

/**
 * Drops the vectors of unlinked assets and indexes the newly linked, processed
 * ones. The rest are indexed once their processing completes.
 */
export const reindexBlockAssets = (params: {
	blockId: BlockId;
	addedIds: readonly AssetId[];
	removedIds: readonly AssetId[];
}) =>
	Effect.gen(function* () {
		const db = yield* DB;

		yield* Effect.forEach(
			params.removedIds,
			(assetId) =>
				deletePointsByIdentifier({
					blockId: params.blockId,
					assetId,
				}),
			{
				concurrency: "unbounded",
				discard: true,
			},
		);

		if (params.addedIds.length === 0) return;

		// Locks the rows without a status filter, so processing completing an asset is waited for; it queues only the links it saw.
		const addedAssets = yield* db
			.select({
				id: dbSchema.asset.id,
				processingStatus: dbSchema.asset.processingStatus,
			})
			.from(dbSchema.asset)
			.where(
				inArray(dbSchema.asset.id, [
					...params.addedIds,
				]),
			)
			.for("share");

		yield* enqueueIndexing({
			blockId: params.blockId,
			assetIds: addedAssets
				.filter((asset) => asset.processingStatus === "completed")
				.map((asset) => asset.id),
		});
	});
