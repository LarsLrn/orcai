import type { BlockId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import {
	onActiveGeneration,
	prepareQueries,
	retrievePassages,
} from "@orcai/qdrant";
import type {
	AssetPoint,
	RetrievedAssetPoint,
	searchRepositoryAssetPointsInputSchema,
} from "@orcai/schema";
import { and, eq, inArray } from "drizzle-orm";
import * as Effect from "effect/Effect";
import type { z } from "zod/v4";
import * as AppErrors from "@/lib/effect/utils/errors";

type RepositorySearch = z.infer<typeof searchRepositoryAssetPointsInputSchema>;

// Each retrieval runs up to four Qdrant queries, so a request keeps 32 in flight at most.
const SEARCH_CONCURRENCY = 8;

/** The points of links that still exist, with their asset's title as it is now. */
export const linkedPoints = (points: readonly AssetPoint[]) =>
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
export const onSearchGeneration = <A, E, R>(read: Effect.Effect<A, E, R>) =>
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

/**
 * The ready repository's member assets among `requested`, or all of them.
 * Membership is read on every call, so a detached asset drops out at once.
 */
export const repositoryAssetScope = (
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

/**
 * Each search's best passages in its repository's member assets, in the
 * order of the searches. Every search runs on one embedding generation, its
 * queries embedded in one request, and all of it again when a newer
 * generation replaces that one. Callers check read access to the
 * repositories first.
 */
export const searchRepositories = (searches: readonly RepositorySearch[]) =>
	Effect.gen(function* () {
		const scoped = yield* Effect.forEach(
			searches,
			(search) =>
				repositoryAssetScope(search.repositoryId, search.filters.assetIds).pipe(
					Effect.map((assetIds) => ({
						search,
						assetIds,
						retrievalMode: search.filters.retrievalMode ?? "dense",
					})),
				),
			{
				concurrency: SEARCH_CONCURRENCY,
			},
		);
		const searched = scoped.filter(({ assetIds }) => assetIds.length > 0);
		const found =
			searched.length === 0
				? []
				: yield* onSearchGeneration(
						Effect.gen(function* () {
							const prepared = yield* prepareQueries(
								searched.map(({ search, retrievalMode }) => ({
									queries: search.filters.queries ?? [],
									retrievalMode,
								})),
							);
							return yield* Effect.forEach(
								searched,
								(
									{
										search: {
											repositoryId,
											filters: {
												queries: _,
												pointIds,
												page,
												pageFrom,
												pageTo,
												passageIndices,
												...policy
											},
										},
										assetIds,
									},
									index,
								) =>
									retrievePassages({
										queries: prepared[index],
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
								{
									concurrency: SEARCH_CONCURRENCY,
								},
							);
						}),
					);
		const answers = new Map(
			searched.map(({ search }, index) => [
				search,
				found[index],
			]),
		);
		return yield* Effect.forEach(
			scoped,
			({ search, retrievalMode }) => {
				const answer = answers.get(search);
				return answer
					? linkedPoints(answer.data).pipe(
							Effect.map((data) => ({
								data,
								metadata: {
									...answer.metadata,
									returnedCount: data.length,
								},
							})),
						)
					: Effect.succeed({
							data: [] as RetrievedAssetPoint[],
							metadata: {
								retrievalMode,
								scoreThreshold: 0,
								candidateCount: 0,
								returnedCount: 0,
							},
						});
			},
			{
				concurrency: SEARCH_CONCURRENCY,
			},
		);
	});
