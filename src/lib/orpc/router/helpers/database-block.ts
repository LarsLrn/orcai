import { eq, getColumns } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { dbSchema } from "@/db/schema";
import { calculateRelationDelta } from "@/lib/authz/relation-delta";
import { AuthzService } from "@/lib/effect/services/authz";
import { DB } from "@/lib/effect/services/drizzle";
import { sendJobBatchEffect } from "@/lib/pg-boss/helpers";
import { VECTORIZE_ASSET_JOB_NAME } from "@/lib/pg-boss/schema/job-queues";
import { deletePointsByIdentifier } from "@/qdrant/mutations";

export const loadDatabaseBlockAssets = (params: { blockId: string }) =>
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
	blockId: string;
	assetIds: string[];
	previousAssetIds?: string[];
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

		const { removedIds, addedIds } = calculateRelationDelta(
			previousAssetIds,
			params.assetIds,
		);

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
			yield* sendJobBatchEffect({
				jobName: VECTORIZE_ASSET_JOB_NAME,
				jobs: addedIds.map((assetId) => ({
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
