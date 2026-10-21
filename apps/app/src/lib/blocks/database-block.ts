import type { AssetId, BlockId, UserId } from "@orcai/core";
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
 * Replaces a database block's asset links and records the change. Call it in
 * `writeRelationships`, then pass the result to {@link reindexBlockAssets}.
 */
export const replaceBlockAssets = (params: {
	blockId: BlockId;
	assetIds: readonly AssetId[];
}) =>
	Effect.gen(function* () {
		const db = yield* DB;

		const previousAssetIds = (yield* db
			.delete(dbSchema.blockAsset)
			.where(eq(dbSchema.blockAsset.blockId, params.blockId))
			.returning({
				assetId: dbSchema.blockAsset.assetId,
			})).map((asset) => asset.assetId);

		if (params.assetIds.length > 0) {
			yield* db.insert(dbSchema.blockAsset).values(
				params.assetIds.map((assetId) => ({
					blockId: params.blockId,
					assetId,
				})),
			);
		}

		yield* recordRelationshipFacts(
			RelationshipFact.BlockAssetsChanged({
				blockId: params.blockId,
				before: previousAssetIds,
				after: params.assetIds,
			}),
		);

		return {
			blockId: params.blockId,
			addedIds: Arr.difference(params.assetIds, previousAssetIds),
			removedIds: Arr.difference(previousAssetIds, params.assetIds),
		};
	});

/** Drops the vectors of unlinked assets and indexes the newly linked, processed ones. */
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

		const completedAssets = yield* db
			.select({
				id: dbSchema.asset.id,
			})
			.from(dbSchema.asset)
			.where(
				and(
					inArray(dbSchema.asset.id, [
						...params.addedIds,
					]),
					eq(dbSchema.asset.processingStatus, "completed"),
				),
			);

		if (completedAssets.length === 0) return;

		yield* sendJobBatch({
			jobName: VECTORIZE_ASSET_JOB_NAME,
			jobs: completedAssets.map((asset) => ({
				data: {
					prefix: asset.id,
					assetId: asset.id,
					blockId: params.blockId,
				},
			})),
			resourceOptions: {
				resourceId: params.blockId,
				resourceType: "block",
			},
		});
	});
