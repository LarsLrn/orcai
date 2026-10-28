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
	 * Chunks per asset admitted before other assets get a turn. Keeps one
	 * verbose document from crowding out the rest; when fewer assets match,
	 * the next-best chunks of any asset fill the remaining slots.
	 */
	maxPerAsset: 2,

	/**
	 * Minimum number of distinct recall candidates required before
	 * skipping the fallback (relaxed-threshold) search pass.
	 */
	minRecallCandidates: 6,
} as const;
