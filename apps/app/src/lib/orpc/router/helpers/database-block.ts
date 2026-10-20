import type { AssetId, BlockId, UserId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { sendJobBatch } from "@orcai/pg-boss";
import { deletePointsByIdentifier } from "@orcai/qdrant";
import { assetIdSchema, VECTORIZE_ASSET_JOB_NAME } from "@orcai/schema";
import { and, eq, getColumns, inArray } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { emptyCapabilities } from "@/lib/authz/capabilities";
import { calculateRelationDelta } from "@/lib/authz/relation-delta";
import { AuthzService } from "@/lib/effect/services/authz";
import * as AppErrors from "@/lib/effect/utils/errors";
import {
	getManyEntityCapabilities,
	permittedEntityIds,
} from "@/lib/orpc/router/helpers/capabilities";

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

export const syncDatabaseBlockAssets = (params: {
	blockId: BlockId;
	assetIds: AssetId[];
	previousAssetIds?: AssetId[];
}) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const authz = yield* AuthzService;

		const previousAssetIds =
			params.previousAssetIds ??
			(yield* db
				.select({
					assetId: dbSchema.blockAsset.assetId,
				})
				.from(dbSchema.blockAsset)
				.where(eq(dbSchema.blockAsset.blockId, params.blockId))
				.pipe(Effect.map((assets) => assets.map((a) => a.assetId))));

		yield* db
			.delete(dbSchema.blockAsset)
			.where(eq(dbSchema.blockAsset.blockId, params.blockId));

		if (params.assetIds.length > 0) {
			yield* db.insert(dbSchema.blockAsset).values(
				params.assetIds.map((assetId) => ({
					blockId: params.blockId,
					assetId,
				})),
			);
		}

		const delta = calculateRelationDelta(previousAssetIds, params.assetIds);

		const removedIds = assetIdSchema.array().parse(delta.removedIds);
		const addedIds = assetIdSchema.array().parse(delta.addedIds);

		if (removedIds.length > 0 || addedIds.length > 0) {
			yield* authz.applyRelationshipMutations({
				mutations: [
					...removedIds.map((assetId) => ({
						resourceType: "asset" as const,
						resourceId: assetId,
						relation: "block" as const,
						subjectType: "block" as const,
						subjectId: params.blockId,
						operation: "delete" as const,
					})),
					...addedIds.map((assetId) => ({
						resourceType: "asset" as const,
						resourceId: assetId,
						relation: "block" as const,
						subjectType: "block" as const,
						subjectId: params.blockId,
						operation: "touch" as const,
					})),
				],
			});
		}

		if (removedIds.length > 0) {
			yield* Effect.forEach(
				removedIds,
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
		}

		if (addedIds.length > 0) {
			const completedAddedAssets = yield* db
				.select({
					id: dbSchema.asset.id,
				})
				.from(dbSchema.asset)
				.where(
					and(
						inArray(dbSchema.asset.id, addedIds),
						eq(dbSchema.asset.processingStatus, "completed"),
					),
				);

			const completedAssetIds = completedAddedAssets.map((asset) => asset.id);

			if (completedAssetIds.length === 0) {
				return {
					assetIds: params.assetIds,
					addedIds,
					removedIds,
				};
			}

			yield* sendJobBatch({
				jobName: VECTORIZE_ASSET_JOB_NAME,
				jobs: completedAssetIds.map((assetId) => ({
					data: {
						prefix: assetId,
						assetId,
						blockId: params.blockId,
					},
				})),
				resourceOptions: {
					resourceId: params.blockId,
					resourceType: "block",
				},
			});
		}

		return {
			assetIds: params.assetIds,
			addedIds,
			removedIds,
		};
	});
