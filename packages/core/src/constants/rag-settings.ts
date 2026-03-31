export const RAG_SETTINGS = {
	/**
	 * The "k" constant used in Reciprocal Rank Fusion (RRF).
	 * A larger value flattens rank differences between candidates;
	 * 60 is the widely-used standard default.
	 */
	retrievalK: 60,

	/**
	 * Maximum number of results returned to the caller by default.
	 * Can be overridden per-request via the `limit` filter parameter.
	 */
	limit: 10,

	/**
	 * Default upper bound on how many Qdrant candidates to fetch before
	 * filtering and re-ranking. The actual limit is typically computed as
	 * `max(limit * 6, candidateLimit)` so it scales with the requested
	 * result count.
	 */
	candidateLimit: 40,

	/**
	 * Maximum number of chunks from the same asset that may appear in
	 * the final result set. Prevents a single verbose document from
	 * dominating the results.
	 */
	maxPerAsset: 2,

	/**
	 * Minimum number of distinct recall candidates required before
	 * skipping the fallback (relaxed-threshold) search pass.
	 */
	minRecallCandidates: 6,
} as const;
