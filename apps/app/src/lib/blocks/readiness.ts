import type { BlockId, OrganizationId, UserId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { assetState, readinessTotals } from "@orcai/preparation";
import type { AssetReadiness, RepositoryReadiness } from "@orcai/schema";
import type { ReadRevision } from "@orcai/spice-db";
import { and, asc, eq, inArray } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { readableIds } from "@/lib/authz/content-access";
import { getManyEntityCapabilities } from "@/lib/authz/entity-capabilities";

/**
 * The readiness of each repository the user can read among `blockIds`, in
 * their order. Unreadable, missing and non-repository ids are left out.
 */
export const loadRepositoryReadiness = (params: {
	blockIds: readonly BlockId[];
	userId: UserId;
	organizationId: OrganizationId | undefined;
	zedToken?: ReadRevision;
}) =>
	Effect.gen(function* () {
		const blockIds = Array.from(new Set(params.blockIds));
		if (blockIds.length === 0) return [];
		const db = yield* DB;

		const capabilities = yield* getManyEntityCapabilities({
			entityType: "block",
			entityIds: blockIds,
			userId: params.userId,
			organizationId: params.organizationId,
			zedToken: params.zedToken,
		});
		const readable = yield* readableIds("block", blockIds, {
			userId: params.userId,
			zedToken: params.zedToken,
		});
		const repositoryIds = blockIds.filter((blockId) => readable.has(blockId));
		if (repositoryIds.length === 0) return [];

		const [blocks, rows] = yield* Effect.all(
			[
				db
					.select({
						id: dbSchema.block.id,
						name: dbSchema.block.name,
					})
					.from(dbSchema.block)
					.where(
						and(
							inArray(dbSchema.block.id, repositoryIds),
							eq(dbSchema.block.type, "repository"),
						),
					),
				db
					.select({
						blockId: dbSchema.blockAsset.blockId,
						assetId: dbSchema.asset.id,
						title: dbSchema.asset.title,
						fileType: dbSchema.asset.fileType,
						processingStatus: dbSchema.asset.processingStatus,
						processingFailure: dbSchema.asset.processingFailure,
						indexStatus: dbSchema.blockAsset.indexStatus,
						indexFailure: dbSchema.blockAsset.indexFailure,
					})
					.from(dbSchema.blockAsset)
					.innerJoin(
						dbSchema.asset,
						eq(dbSchema.asset.id, dbSchema.blockAsset.assetId),
					)
					.where(inArray(dbSchema.blockAsset.blockId, repositoryIds))
					.orderBy(asc(dbSchema.asset.title)),
			],
			{
				concurrency: "unbounded",
			},
		);

		const nameById = new Map(
			blocks.map((block) => [
				block.id,
				block.name,
			]),
		);

		return repositoryIds.flatMap((blockId): RepositoryReadiness[] => {
			const name = nameById.get(blockId);
			const blockCapabilities = capabilities.get(blockId);
			if (name === undefined || !blockCapabilities) return [];
			const assets = rows
				.filter((row) => row.blockId === blockId)
				.map(
					(row): AssetReadiness => ({
						assetId: row.assetId,
						title: row.title,
						fileType: row.fileType,
						...assetState(row),
					}),
				);
			return [
				{
					blockId,
					name,
					capabilities: blockCapabilities,
					totals: readinessTotals(assets),
					assets,
				},
			];
		});
	});
