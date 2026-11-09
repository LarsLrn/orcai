import { RAG_SETTINGS } from "@orcai/core";
import type {
	AssetPoint,
	AssetPointPayload,
	RetrievalMode,
} from "@orcai/schema";
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import { buildQdrantFilter } from "./filter";
import { EmbeddingGeneration } from "./generation";
import { queryAssetPoints, type RetrievalQuery } from "./queries";
import { selectDiversePoints } from "./utils/result-set";

/** The points a search may return: a repository's served points of `assetIds`, narrowed by the rest. */
type RetrievalScope = {
	readonly blockId: string;
	readonly assetIds: readonly string[];
	readonly pointIds?: readonly string[];
	readonly page?: number;
	readonly pageFrom?: number;
	readonly pageTo?: number;
	readonly passageIndices?: readonly number[];
	readonly source?: AssetPointPayload["source"];
};

type RetrievalPolicy = {
	readonly retrievalMode?: RetrievalMode;
	readonly limit?: number;
	/** How many points each ranking contributes, and the fused list holds, before picking per asset. */
	readonly candidateLimit?: number;
	readonly maxPerAsset?: number;
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
 * were found. Every distinct wording ranks the scope once and Qdrant fuses the
 * rankings, so a point several wordings find ranks higher. Without queries,
 * the scope's points, in `pointIds` order when given. The queries' vectors
 * must come from the generation it runs on.
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
		const retrievalMode = policy.retrievalMode ?? "dense";

		if (scope.assetIds.length === 0) {
			return {
				data: [] as AssetPoint[],
				metadata: {
					retrievalMode,
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
			source: scope.source,
		});

		if (queries.length === 0) {
			const points = yield* queryAssetPoints({
				filter,
				limit,
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
					candidateCount: points.length,
					returnedCount: points.length,
				},
			};
		}

		const candidates = yield* queryAssetPoints({
			queries: Arr.dedupeWith(queries, (a, b) => a.text === b.text),
			filter,
			limit: Math.max(
				limit,
				policy.candidateLimit ?? RAG_SETTINGS.candidateLimit,
			),
			retrievalMode,
		});
		const selected = selectDiversePoints(candidates, {
			limit,
			maxPerAsset: policy.maxPerAsset ?? RAG_SETTINGS.maxPerAsset,
		});

		return {
			data: selected,
			metadata: {
				retrievalMode,
				candidateCount: candidates.length,
				returnedCount: selected.length,
			},
		};
	});
