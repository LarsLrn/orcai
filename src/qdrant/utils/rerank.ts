import { clamp } from "effect/Number";
import type { AssetPoint } from "@/lib/orpc/schemas/asset-point";
import { normalizeText, tokenize } from "@/lib/utils/text-utils";
import { RAG_SETTINGS } from "@/settings/constants";

/**
 * Computes a 0–1 lexical overlap score between a tokenized query and a
 * raw content string.
 *
 * Score = (fraction of query tokens present in content)
 *       + 0.2 phrase bonus (if the full query appears verbatim).
 *
 * The phrase bonus is particularly valuable for short factual queries where
 * an exact substring match is strong evidence of relevance.
 *
 * @param queryTokens - Pre-tokenized query terms.
 * @param content     - Raw text of the candidate chunk.
 */
const lexicalScore = (queryTokens: string[], content: string): number => {
	if (queryTokens.length === 0) return 0;

	const normalizedContent = normalizeText(content);
	if (!normalizedContent) return 0;

	const contentTokens = tokenize(normalizedContent);
	if (contentTokens.length === 0) return 0;

	// Build a set from content tokens for O(1) membership tests.
	const tokenSet = new Set(contentTokens);
	const matched = queryTokens.filter((token) => tokenSet.has(token)).length;
	const coverage = matched / queryTokens.length;

	// Phrase presence bonus helps short factual queries.
	const phraseBonus = normalizedContent.includes(queryTokens.join(" "))
		? 0.2
		: 0;
	return clamp(coverage + phraseBonus, {
		minimum: 0,
		maximum: 1,
	});
};

/**
 * Re-ranks candidate points by fusing dense vector scores with lexical
 * (token-overlap) scores using a combination of weighted scores and
 * Reciprocal Rank Fusion (RRF).
 *
 * Final score formula for each point p:
 *
 *   score(p) = denseWeight  * clamp(denseSimilarity(p), 0, 1)
 *            + lexicalWeight * lexicalScore(p)
 *            + 0.2 * (RRF_dense(p) + RRF_lexical(p))
 *
 * where:
 *   RRF_dense(p)   = 1 / (RETRIEVAL_K + rank_by_dense + 1)
 *   RRF_lexical(p) = 1 / (RETRIEVAL_K + rank_by_lexical + 1)
 *
 * The RRF component rewards points that rank highly in *both* orderings,
 * even if neither score alone is outstanding — it acts as a smoothing
 * term that captures consensus between the two signals.
 *
 * Default weights for hybrid mode: denseWeight=0.65, lexicalWeight=0.35.
 *
 * @param query        - Original search string (used to compute lexical scores).
 * @param points       - Candidate points with their dense similarity scores.
 * @param denseWeight  - Weight applied to the dense cosine score.
 * @param lexicalWeight- Weight applied to the lexical overlap score.
 * @returns Points sorted by descending fused score.
 */
export const rerankHybrid = ({
	query,
	points,
	denseWeight,
	lexicalWeight,
}: {
	query: string;
	points: AssetPoint[];
	denseWeight: number;
	lexicalWeight: number;
}) => {
	const queryTokens = tokenize(query);

	// Compute lexical scores for all points up-front; reused several times.
	const lexicalScores = points.map((point) =>
		lexicalScore(queryTokens, point.payload.text ?? ""),
	);

	// Build rank maps for both orderings. rank=0 is the best result.
	const denseRanks = new Map<string, number>();
	const lexicalRanks = new Map<string, number>();

	// Sort a copy by dense score descending to assign dense ranks.
	points
		.slice()
		.sort((a, b) => b.score - a.score)
		.forEach((point, rank) => {
			denseRanks.set(String(point.id), rank);
		});

	// Pair each point with its lexical score, sort, and assign lexical ranks.
	points
		.map((point, index) => ({ point, score: lexicalScores[index] }))
		.sort((a, b) => b.score - a.score)
		.forEach(({ point }, rank) => {
			lexicalRanks.set(String(point.id), rank);
		});

	// Compute the final fused score for every point and re-sort.
	const fusedPoints = points
		.map((point, index) => {
			const denseRank = denseRanks.get(String(point.id)) ?? points.length;
			const lexicalRank = lexicalRanks.get(String(point.id)) ?? points.length;

			// RRF terms — higher rank (lower index) gives a higher contribution.
			const denseRrf = 1 / (RAG_SETTINGS.retrievalK + denseRank + 1);
			const lexicalRrf = 1 / (RAG_SETTINGS.retrievalK + lexicalRank + 1);

			const fused =
				denseWeight *
					clamp(point.score, {
						minimum: 0,
						maximum: 1,
					}) +
				lexicalWeight *
					clamp(lexicalScores[index], {
						minimum: 0,
						maximum: 1,
					}) +
				0.2 * (denseRrf + lexicalRrf); // RRF consensus bonus.

			return {
				...point,
				score: clamp(fused, {
					minimum: 0,
					maximum: 1,
				}),
			};
		})
		.sort((a, b) => b.score - a.score);

	return fusedPoints;
};
