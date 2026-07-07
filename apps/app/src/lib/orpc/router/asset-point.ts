import { generateEmbedding } from "@orcai/ai";
import { RAG_SETTINGS } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import {
	applyAssetDiversityCap,
	buildQdrantFilter,
	dedupeById,
	mergeRecallCandidates,
	queryAssetPoints,
	rerankHybrid,
	resolveScoreThreshold,
} from "@orcai/qdrant";
import type { AssetPoint, assetPointsFiltersSchema } from "@orcai/schema";
import { eq } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { clamp } from "effect/Number";
import type { z } from "zod/v4";
import * as AppErrors from "@/lib/effect/utils/errors";
import { authed } from "@/lib/orpc/implementation/authed";
import { requireEntityPermission } from "@/lib/orpc/middlewares/permission";

const retrieveAssetPoints = (
	filters: z.infer<typeof assetPointsFiltersSchema>,
) =>
	Effect.gen(function* () {
		const input = {
			filters,
		};
		const limit = input.filters.limit ?? RAG_SETTINGS.limit;
		const retrievalMode = input.filters.retrievalMode ?? "dense";

		const scoreThreshold = resolveScoreThreshold({
			explicit: input.filters.minScore,
			queries: input.filters.queries,
		});

		const candidateLimit = Math.max(
			limit,
			input.filters.candidateLimit ??
				Math.max(limit * 6, RAG_SETTINGS.candidateLimit),
		);

		const maxPerAsset = input.filters.maxPerAsset ?? RAG_SETTINGS.maxPerAsset;

		const denseWeight =
			input.filters.denseWeight ?? (retrievalMode === "hybrid" ? 0.65 : 1);
		const lexicalWeight =
			input.filters.lexicalWeight ?? (retrievalMode === "hybrid" ? 0.35 : 0);

		const qdrantFilter = buildQdrantFilter({
			pointIds: input.filters.pointIds,
			assetIds: input.filters.assetIds,
			blockId: input.filters.blockId,
			page: input.filters.page,
			pageFrom: input.filters.pageFrom,
			pageTo: input.filters.pageTo,
			chunkIndices: input.filters.chunkIndices,
		});

		if (!input.filters.queries || input.filters.queries.length === 0) {
			return yield* queryAssetPoints({
				filter: qdrantFilter,
				limit,
				withPayload: true,
				withVector: false,
				retrievalMode,
			}).pipe(
				Effect.map((points) => {
					const pointIds = input.filters.pointIds ?? [];
					const idOrder =
						pointIds.length > 0
							? new Map(
									pointIds.map((id, index) => [
										String(id),
										index,
									]),
								)
							: undefined;

					if (idOrder) {
						points.sort(
							(a, b) =>
								(idOrder.get(String(a.id)) ?? Number.MAX_SAFE_INTEGER) -
								(idOrder.get(String(b.id)) ?? Number.MAX_SAFE_INTEGER),
						);
					}

					return {
						data: points,
						metadata: {
							retrievalMode,
							scoreThreshold: 0,
							candidateCount: points.length,
							returnedCount: points.length,
						},
					};
				}),
			);
		}

		const searchQueries = input.filters.queries;

		const recallTarget = Math.max(RAG_SETTINGS.minRecallCandidates, limit * 2);

		const recallPasses = [
			{
				scoreThreshold,
				candidateLimit,
			},
			{
				scoreThreshold: clamp(scoreThreshold - 0.22, {
					maximum: 1,
					minimum: 0.15,
				}),
				candidateLimit: Math.min(
					200,
					Math.max(80, candidateLimit * 2, limit * 12),
				),
			},
		];

		const variants =
			retrievalMode === "sparse"
				? searchQueries.map((query) => ({
						query,
						embedding: undefined,
					}))
				: yield* Effect.forEach(
						searchQueries,
						(query) =>
							generateEmbedding({
								value: query,
							}).pipe(
								Effect.map(({ embedding }) => ({
									query,
									embedding,
								})),
							),
						{
							concurrency: 4,
						},
					);

		const recallCandidates = new Map<
			string,
			{
				point: AssetPoint;
				hitCount: number;
			}
		>();

		let usedFallbackPass = false;
		let appliedScoreThreshold = scoreThreshold;

		for (const [index, pass] of recallPasses.entries()) {
			yield* Effect.forEach(
				variants,
				({ query, embedding }) =>
					queryAssetPoints({
						embedding,
						text: query,
						filter: qdrantFilter,
						limit: pass.candidateLimit,
						withPayload: true,
						withVector: false,
						scoreThreshold: pass.scoreThreshold,
						retrievalMode,
					}).pipe(
						Effect.map((points) =>
							mergeRecallCandidates(recallCandidates, points),
						),
					),
				{
					concurrency: 4,
				},
			);

			usedFallbackPass ||= index > 0;
			appliedScoreThreshold = pass.scoreThreshold;

			if (recallCandidates.size >= recallTarget) {
				break;
			}
		}

		const basePoints = dedupeById(
			Array.from(recallCandidates.values()).map(({ point, hitCount }) => ({
				...point,
				score: clamp(point.score + Math.min(0.12, (hitCount - 1) * 0.03), {
					maximum: 1,
					minimum: 0,
				}),
			})),
		);

		const rankedPoints =
			retrievalMode === "hybrid"
				? rerankHybrid({
						query: searchQueries[0],
						points: basePoints,
						denseWeight,
						lexicalWeight,
					})
				: basePoints.sort((a, b) => b.score - a.score);

		const selectedPoints = applyAssetDiversityCap(
			rankedPoints,
			usedFallbackPass ? Math.max(maxPerAsset, 4) : maxPerAsset,
		).slice(0, limit);

		return {
			data: selectedPoints,
			metadata: {
				retrievalMode,
				scoreThreshold: appliedScoreThreshold,
				candidateCount: basePoints.length,
				returnedCount: selectedPoints.length,
			},
		};
	});

export const listAssetPoint = authed.assetPoint.list
	.use(
		requireEntityPermission("asset", "read", {
			entityId: "assetId",
		}),
	)
	.effect(function* ({ input }) {
		return yield* retrieveAssetPoints({
			...input.filters,
			assetIds: [
				input.assetId,
			],
		});
	});

export const searchRepositoryAssetPoint = authed.assetPoint.searchRepository
	.use(
		requireEntityPermission("block", "read", {
			entityId: "repositoryId",
		}),
	)
	.effect(function* ({ input }) {
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
			.where(eq(dbSchema.block.id, input.repositoryId));

		const repository = rows[0];
		if (repository?.type !== "database" || repository.status !== "ready") {
			return yield* Effect.fail(
				new AppErrors.NotFoundError({
					message: "Repository not found",
				}),
			);
		}

		const permittedAssetIds = new Set<string>(
			rows.flatMap((row) =>
				row.assetId
					? [
							row.assetId,
						]
					: [],
			),
		);
		const requestedAssetIds = input.filters.assetIds;
		const assetIds = requestedAssetIds
			? requestedAssetIds.filter((assetId) => permittedAssetIds.has(assetId))
			: Array.from(permittedAssetIds);

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

		return yield* retrieveAssetPoints({
			...input.filters,
			blockId: input.repositoryId,
			assetIds,
		});
	});
