export const COOKIES = {
	ZED_TOKEN: {
		name: "zed_token",
		expires: 1, // days
	},
};

export const HEADERS = {
	X_ZED_TOKEN: "X-Zed-Token",
};

export const DOCLING_DEFAULT_TIMEOUT = 15 * 60 * 1000;

export const CHAT_ATTACHMENT_DOCUMENT_MIME_TYPES = new Set([
	"application/pdf",
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	"application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

export const CHAT_ATTACHMENT_MAX_ATTACHMENT_TEXT_LENGTH = 20_000;

export const CHAT_ATTACHMENT_LIMIT = 8;

export const CHAT_ATTACHMENT_ACCEPT =
	"image/*,application/pdf,text/*,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation";

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

export const RETRIEVAL_LIMITS = {
	maxSnippetResultsPerCall: 8,
	maxFullChunkFetches: 8,
	snippetLengthChars: 360,
} as const;

export const AUTHZ = {
	outboxRetryBaseDelayMs: 30_000,
	outboxProcessingStaleAfterMs: 5 * 60_000,
};
