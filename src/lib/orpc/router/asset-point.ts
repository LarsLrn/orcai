import * as Effect from "effect/Effect";
import { clamp } from "effect/Number";
import { generateEmbedding } from "@/lib/ai/embedding";
import { QdrantService } from "@/lib/effect/services/qdrant";
import { QdrantError } from "@/lib/effect/utils/errors";
import { runOrpcEffect } from "@/lib/effect/utils/orpc-helpers";
import { authed } from "@/lib/orpc/implementation/authed";
import { qdrantCollections } from "@/qdrant/qdrant-constants";
import { buildQdrantFilter } from "@/qdrant/utils/build-qdrant-filter";
import { rerankHybrid } from "@/qdrant/utils/rerank";
import {
	applyAssetDiversityCap,
	dedupeById,
	mergeRecallCandidates,
	normalizePoint,
} from "@/qdrant/utils/result-set";
import { resolveScoreThreshold } from "@/qdrant/utils/score";
import { RAG_SETTINGS } from "@/settings/constants";
import type { QdrantPoints } from "@/types/qdrant";

export const listAssetPoint = authed.assetPoint.list.handler(({ input }) =>
	runOrpcEffect(
		Effect.gen(function* () {
			const { client } = yield* QdrantService;

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
				return yield* Effect.tryPromise({
					try: async () =>
						client.scroll(qdrantCollections.asset.name, {
							filter: qdrantFilter,
							limit,
							with_payload: true,
							with_vector: false,
						}),
					catch: (error) =>
						new QdrantError({
							operation: "scroll",
							cause: error,
						}),
				}).pipe(
					Effect.map((response) => {
						const pointIds = input.filters.pointIds ?? [];
						const idOrder =
							pointIds.length > 0
								? new Map(pointIds.map((id, index) => [String(id), index]))
								: undefined;

						const points = (response.points as QdrantPoints["points"]).map(
							normalizePoint,
						);
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
				{ point: QdrantPoints["points"][number]; hitCount: number }
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
							const responses = yield* Effect.forEach(
								variantEmbeddings,
								(embedding) =>
									Effect.tryPromise({
										try: () =>
											client.query(qdrantCollections.asset.name, {
												query: embedding,
												filter: qdrantFilter,
												limit: pass.candidateLimit,
												with_payload: true,
												with_vector: false,
												score_threshold: pass.scoreThreshold,
											}),
										catch: (error) =>
											new QdrantError({ operation: "query", cause: error }),
									}),
								{ concurrency: 4 },
							);

							for (const response of responses) {
								mergeRecallCandidates(
									recallCandidates,
									(response.points as QdrantPoints["points"]).map(
										normalizePoint,
									),
								);
							}

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
