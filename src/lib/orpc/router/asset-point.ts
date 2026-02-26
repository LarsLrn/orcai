import * as Effect from "effect/Effect";
import { clamp } from "effect/Number";
import { generateEmbedding } from "@/lib/ai/embedding";
import { runOrpcEffect } from "@/lib/effect/utils/orpc-helpers";
import { authed } from "@/lib/orpc/implementation/authed";
import type { AssetPoint } from "@/lib/orpc/schemas/asset-point";
import { queryAssetPoints } from "@/qdrant/queries";
import { buildQdrantFilter } from "@/qdrant/utils/build-qdrant-filter";
import { rerankHybrid } from "@/qdrant/utils/rerank";
import {
	applyAssetDiversityCap,
	dedupeById,
	mergeRecallCandidates,
} from "@/qdrant/utils/result-set";
import { resolveScoreThreshold } from "@/qdrant/utils/score";
import { RAG_SETTINGS } from "@/settings/constants";

export const listAssetPoint = authed.assetPoint.list.handler(({ input }) =>
	runOrpcEffect(
		Effect.gen(function* () {
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
				}).pipe(
					Effect.map((points) => {
						const pointIds = input.filters.pointIds ?? [];
						const idOrder =
							pointIds.length > 0
								? new Map(pointIds.map((id, index) => [String(id), index]))
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
								retrievalMode: "dense" as const,
								scoreThreshold: 0,
								candidateCount: points.length,
								returnedCount: points.length,
							},
						};
					}),
				);
			}

			const searchQueries = input.filters.queries;

			const recallTarget = Math.max(
				RAG_SETTINGS.minRecallCandidates,
				limit * 2,
			);

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

			const variantEmbeddings = yield* Effect.forEach(
				searchQueries,
				(query) =>
					generateEmbedding(query).pipe(
						Effect.map(({ embedding }) => embedding),
					),
				{ concurrency: 4 },
			);

			const recallCandidates = new Map<
				string,
				{ point: AssetPoint; hitCount: number }
			>();

			const passState = yield* Effect.reduceWhile(
				recallPasses,
				{
					done: false,
					usedFallbackPass: false,
					appliedScoreThreshold: scoreThreshold,
				},
				{
					while: (s) => !s.done,
					body: (s, pass, index) =>
						Effect.gen(function* () {
							yield* Effect.forEach(
								variantEmbeddings,
								(embedding) =>
									queryAssetPoints({
										embedding,
										filter: qdrantFilter,
										limit: pass.candidateLimit,
										withPayload: true,
										withVector: false,
										scoreThreshold: pass.scoreThreshold,
									}).pipe(
										Effect.map((points) =>
											mergeRecallCandidates(recallCandidates, points),
										),
									),
								{ concurrency: 4 },
							);

							return {
								done: recallCandidates.size >= recallTarget,
								usedFallbackPass: s.usedFallbackPass || index > 0,
								appliedScoreThreshold: pass.scoreThreshold,
							};
						}),
				},
			);

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
				passState.usedFallbackPass ? Math.max(maxPerAsset, 4) : maxPerAsset,
			).slice(0, limit);

			return {
				data: selectedPoints,
				metadata: {
					retrievalMode,
					scoreThreshold: passState.appliedScoreThreshold,
					candidateCount: basePoints.length,
					returnedCount: selectedPoints.length,
				},
			};
		}),
	),
);
