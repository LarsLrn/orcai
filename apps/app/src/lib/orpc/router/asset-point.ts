import type { BlockId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import {
	browseAssetPoints,
	buildQdrantFilter,
	onActiveGeneration,
	prepareQueries,
	retrievePassages,
} from "@orcai/qdrant";
import type {
	AssetPoint,
	assetPointsFiltersSchema,
	RetrievedAssetPoint,
} from "@orcai/schema";
import { and, eq, inArray } from "drizzle-orm";
import * as Effect from "effect/Effect";
import type { z } from "zod/v4";
import * as AppErrors from "@/lib/effect/utils/errors";
import { authed } from "@/lib/orpc/implementation/authed";
import { requireEntityAccess } from "@/lib/orpc/middlewares/permission";

/** The points of links that still exist, with their asset's title as it is now. */
const linkedPoints = (points: readonly AssetPoint[]) =>
	Effect.gen(function* () {
		if (points.length === 0) return [];
		const links = yield* (yield* DB)
			.select({
				blockId: dbSchema.blockAsset.blockId,
				assetId: dbSchema.blockAsset.assetId,
				title: dbSchema.asset.title,
			})
			.from(dbSchema.blockAsset)
			.innerJoin(
				dbSchema.asset,
				eq(dbSchema.asset.id, dbSchema.blockAsset.assetId),
			)
			.where(
				and(
					inArray(dbSchema.blockAsset.blockId, [
						...new Set(points.map((point) => point.payload.block_id)),
					]),
					inArray(dbSchema.blockAsset.assetId, [
						...new Set(points.map((point) => point.payload.asset_id)),
					]),
				),
			);
		const linkOf = new Map(
			links.map((link) => [
				`${link.blockId}/${link.assetId}`,
				link,
			]),
		);

		return points.flatMap((point): RetrievedAssetPoint[] => {
			const link = linkOf.get(
				`${point.payload.block_id}/${point.payload.asset_id}`,
			);
			return link
				? [
						{
							...point,
							title: link.title,
						},
					]
				: [];
		});
	});

/** Runs `read` on the active embedding generation; without one, search is unavailable. */
const onSearchGeneration = <A, E, R>(read: Effect.Effect<A, E, R>) =>
	onActiveGeneration(read).pipe(
		Effect.catchTag("EmbeddingsNotConfiguredError", (cause) =>
			Effect.fail(
				new AppErrors.ConflictError({
					reason: "EMBEDDINGS_NOT_CONFIGURED",
					message:
						"Search is unavailable until an instance admin sets up embeddings.",
					cause,
				}),
			),
		),
	);

/** The repository's best points for the search in `filters`, as the router's response. */
const retrieveAssetPoints = (
	repositoryId: BlockId,
	assetIds: readonly string[],
	{
		queries = [],
		pointIds,
		page,
		pageFrom,
		pageTo,
		passageIndices,
		...policy
	}: z.infer<typeof assetPointsFiltersSchema>,
) =>
	onSearchGeneration(
		prepareQueries([
			{
				queries,
				retrievalMode: policy.retrievalMode ?? "dense",
			},
		]).pipe(
			Effect.flatMap(([prepared]) =>
				retrievePassages({
					queries: prepared,
					scope: {
						blockId: repositoryId,
						assetIds,
						pointIds,
						page,
						pageFrom,
						pageTo,
						passageIndices,
					},
					policy,
				}),
			),
		),
	).pipe(
		Effect.flatMap((result) =>
			linkedPoints(result.data).pipe(
				Effect.map((data) => ({
					data,
					metadata: {
						...result.metadata,
						returnedCount: data.length,
					},
				})),
			),
		),
	);

/**
 * The ready repository's member assets among `requested`, or all of them.
 * Membership is read on every call, so a detached asset drops out at once.
 */
const repositoryAssetScope = (
	repositoryId: BlockId,
	requested: readonly string[] | undefined,
) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const rows = yield* db
			.select({
				type: dbSchema.block.type,
				status: dbSchema.block.status,
				assetId: dbSchema.blockAsset.assetId,
			})
			.from(dbSchema.block)
			.leftJoin(
				dbSchema.blockAsset,
				eq(dbSchema.blockAsset.blockId, dbSchema.block.id),
			)
			.where(eq(dbSchema.block.id, repositoryId));

		const repository = rows[0];
		if (repository?.type !== "repository" || repository.status !== "ready") {
			return yield* Effect.fail(
				new AppErrors.NotFoundError({
					reason: "REPOSITORY_NOT_FOUND",
					message: "Repository not found",
				}),
			);
		}

		const members = new Set<string>(
			rows.flatMap((row) =>
				row.assetId
					? [
							row.assetId,
						]
					: [],
			),
		);
		return requested
			? requested.filter((assetId) => members.has(assetId))
			: Array.from(members);
	});

const searchRepositoryAssetPoint = authed.assetPoint.searchRepository
	.use(
		requireEntityAccess("block", "read", {
			entityId: "repositoryId",
		}),
	)
	.effect(function* ({ input }) {
		const assetIds = yield* repositoryAssetScope(
			input.repositoryId,
			input.filters.assetIds,
		);

		if (assetIds.length === 0) {
			return {
				data: [],
				metadata: {
					retrievalMode: input.filters.retrievalMode ?? "dense",
					scoreThreshold: 0,
					candidateCount: 0,
					returnedCount: 0,
				},
			};
		}

		return yield* retrieveAssetPoints(
			input.repositoryId,
			assetIds,
			input.filters,
		);
	});

const BROWSE_PAGE_SIZE = 50;

const browseRepositoryAssetPoint = authed.assetPoint.browseRepository
	.use(
		requireEntityAccess("block", "read", {
			entityId: "repositoryId",
		}),
	)
	.effect(function* ({ input }) {
		const assetIds = yield* repositoryAssetScope(
			input.repositoryId,
			input.assetId
				? [
						input.assetId,
					]
				: undefined,
		);

		if (assetIds.length === 0) {
			return {
				data: [],
				nextCursor: null,
			};
		}

		return yield* onSearchGeneration(
			browseAssetPoints({
				filter: buildQdrantFilter({
					blockId: input.repositoryId,
					assetIds,
				}),
				order: input.assetId ? "reading" : "point",
				cursor: input.cursor,
				limit: BROWSE_PAGE_SIZE,
			}),
		).pipe(
			Effect.flatMap((page) =>
				linkedPoints(page.data).pipe(
					Effect.map((data) => ({
						...page,
						data,
					})),
				),
			),
		);
	});

export const assetPointRouter = {
	searchRepository: searchRepositoryAssetPoint,
	browseRepository: browseRepositoryAssetPoint,
};
