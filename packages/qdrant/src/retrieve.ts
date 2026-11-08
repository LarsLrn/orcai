import { RAG_SETTINGS } from "@orcai/core";
import type { AssetPoint, RetrievalMode } from "@orcai/schema";
import * as Effect from "effect/Effect";
import { clamp } from "effect/Number";
import { buildQdrantFilter } from "./filter";
import { EmbeddingGeneration } from "./generation";
import { queryAssetPoints } from "./queries";
import { rerankHybrid } from "./utils/rerank";
import { mergeRecallCandidates, selectDiversePoints } from "./utils/result-set";
import { resolveScoreThreshold } from "./utils/score";

/** A search wording, with its vector from the active generation's model unless the search is sparse. */
type RetrievalQuery = {
	readonly text: string;
	readonly vector?: number[];
};

/** The points a search may return: a repository's served points of `assetIds`, narrowed by the rest. */
type RetrievalScope = {
	readonly blockId: string;
	readonly assetIds: readonly string[];
	readonly pointIds?: readonly string[];
	readonly page?: number;
	readonly pageFrom?: number;
	readonly pageTo?: number;
	readonly passageIndices?: readonly number[];
};

type RetrievalPolicy = {
	readonly retrievalMode?: RetrievalMode;
	readonly limit?: number;
	/** The result count the recall passes gather candidates for; defaults to `limit`. */
	readonly recallLimit?: number;
	readonly candidateLimit?: number;
	readonly minScore?: number;
	readonly maxPerAsset?: number;
	readonly denseWeight?: number;
	readonly lexicalWeight?: number;
};

/**
 * Each search's wordings as queries on the active generation. The distinct
 * wordings of every dense or hybrid search go to the model in one request;
 * sparse searches need no vectors.
 */
export const prepareQueries = (
	searches: readonly {
		readonly queries: readonly string[];
		readonly retrievalMode: RetrievalMode;
	}[],
) =>
	Effect.gen(function* () {
		const embeds = ({ retrievalMode }: (typeof searches)[number]) =>
			retrievalMode !== "sparse";
		const texts = [
			...new Set(searches.filter(embeds).flatMap(({ queries }) => queries)),
		];
		const vectors = new Map<string, number[]>();
		if (texts.length > 0) {
			const { embedQueries } = yield* EmbeddingGeneration;
			const embedded = yield* embedQueries(texts);
			texts.forEach((text, index) => {
				vectors.set(text, embedded[index]);
			});
		}
		return searches.map((search) =>
			search.queries.map(
				(text): RetrievalQuery => ({
					text,
					...(embeds(search)
						? {
								vector: vectors.get(text),
							}
						: {}),
				}),
			),
		);
	});

/**
 * The best points in `scope` for `queries`, ranked by `policy`, with how they
 * were found. Without queries, the scope's points, in `pointIds` order when
 * given. The queries' vectors must come from the generation it runs on.
 */
export const retrievePassages = ({
	queries,
	scope,
	policy,
}: {
	queries: readonly RetrievalQuery[];
	scope: RetrievalScope;
	policy: RetrievalPolicy;
}) =>
	Effect.gen(function* () {
		const limit = policy.limit ?? RAG_SETTINGS.limit;
		const recallLimit = policy.recallLimit ?? limit;
		const retrievalMode = policy.retrievalMode ?? "dense";

		if (scope.assetIds.length === 0) {
			return {
				data: [] as AssetPoint[],
				metadata: {
					retrievalMode,
					scoreThreshold: 0,
					candidateCount: 0,
					returnedCount: 0,
				},
			};
		}

		const filter = buildQdrantFilter({
			pointIds: scope.pointIds,
			assetIds: scope.assetIds,
			blockId: scope.blockId,
			page: scope.page,
			pageFrom: scope.pageFrom,
			pageTo: scope.pageTo,
			chunkIndices: scope.passageIndices,
		});

		if (queries.length === 0) {
			const points = yield* queryAssetPoints({
				filter,
				limit,
				retrievalMode,
			});
			const pointIds = scope.pointIds ?? [];
			if (pointIds.length > 0) {
				const idOrder = new Map(
					pointIds.map((id, index) => [
						id,
						index,
					]),
				);
				points.sort(
					(a, b) =>
						(idOrder.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
						(idOrder.get(b.id) ?? Number.MAX_SAFE_INTEGER),
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
		}

		const scoreThreshold = resolveScoreThreshold({
			explicit: policy.minScore,
			queries: queries.map(({ text }) => text),
		});
		const candidateLimit = Math.max(
			limit,
			policy.candidateLimit ??
				Math.max(recallLimit * 6, RAG_SETTINGS.candidateLimit),
		);
		const maxPerAsset = policy.maxPerAsset ?? RAG_SETTINGS.maxPerAsset;
		const denseWeight =
			policy.denseWeight ?? (retrievalMode === "hybrid" ? 0.65 : 1);
		const lexicalWeight =
			policy.lexicalWeight ?? (retrievalMode === "hybrid" ? 0.35 : 0);
		const recallTarget = Math.max(
			RAG_SETTINGS.minRecallCandidates,
			recallLimit * 2,
		);
		// A second, looser pass runs when the first finds too few candidates.
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
					Math.max(80, candidateLimit * 2, recallLimit * 12),
				),
			},
		];

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
				queries,
				({ text, vector }) =>
					queryAssetPoints({
						embedding: vector,
						text,
						filter,
						limit: pass.candidateLimit,
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
			if (recallCandidates.size >= recallTarget) break;
		}

		// A point found by several wordings ranks a little higher.
		const candidates = Array.from(recallCandidates.values()).map(
			({ point, hitCount }) => ({
				...point,
				score: clamp(point.score + Math.min(0.12, (hitCount - 1) * 0.03), {
					maximum: 1,
					minimum: 0,
				}),
			}),
		);
		const ranked =
			retrievalMode === "hybrid"
				? rerankHybrid({
						query: queries[0].text,
						points: candidates,
						denseWeight,
						lexicalWeight,
					})
				: candidates.sort((a, b) => b.score - a.score);
		const selected = selectDiversePoints(ranked, {
			limit,
			maxPerAsset: usedFallbackPass ? Math.max(maxPerAsset, 4) : maxPerAsset,
		});

		return {
			data: selected,
			metadata: {
				retrievalMode,
				scoreThreshold: appliedScoreThreshold,
				candidateCount: candidates.length,
				returnedCount: selected.length,
			},
		};
	});
