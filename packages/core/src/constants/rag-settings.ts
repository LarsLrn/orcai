export const RAG_SETTINGS = {
	/**
	 * Maximum number of results returned to the caller by default.
	 * Can be overridden per-request via the `limit` filter parameter.
	 */
	limit: 10,

	/**
	 * How many points each ranking of a search contributes, and the fused
	 * list holds, before the results are picked per asset. At least `limit`.
	 */
	candidateLimit: 40,

	/**
	 * Passages per asset admitted before other assets get a turn. Keeps one
	 * verbose asset from crowding out the rest; when fewer assets match,
	 * the next-best passages of any asset fill the remaining slots.
	 */
	maxPerAsset: 2,
} as const;
