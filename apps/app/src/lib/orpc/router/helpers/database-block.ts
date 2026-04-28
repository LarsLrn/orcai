import type { AssetId, BlockId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { sendJobBatch } from "@orcai/pg-boss";
import { deletePointsByIdentifier } from "@orcai/qdrant";
import { assetIdSchema, VECTORIZE_ASSET_JOB_NAME } from "@orcai/schema";
import { and, eq, getColumns, inArray } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { calculateRelationDelta } from "@/lib/authz/relation-delta";
import { AuthzService } from "@/lib/effect/services/authz";

export const loadDatabaseBlockAssets = (params: { blockId: BlockId }) =>
	Effect.gen(function* () {
		const db = yield* DB;

		return yield* db
			.select({
				...getColumns(dbSchema.asset),
			})
			.from(dbSchema.blockAsset)
			.innerJoin(
				dbSchema.asset,
				eq(dbSchema.asset.id, dbSchema.blockAsset.assetId),
			)
			.where(eq(dbSchema.blockAsset.blockId, params.blockId));
	});

export const syncDatabaseBlockAssets = (params: {
	blockId: BlockId;
	assetIds: AssetId[];
	previousAssetIds?: AssetId[];
}) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const authz = yield* AuthzService;

		const previousAssetIds = yield* Effect.orElse(
			Effect.fromNullable(params.previousAssetIds),
			() =>
				db
					.select({
						assetId: dbSchema.blockAsset.assetId,
					})
					.from(dbSchema.blockAsset)
					.where(eq(dbSchema.blockAsset.blockId, params.blockId))
					.pipe(Effect.map((assets) => assets.map((a) => a.assetId))),
		);

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
