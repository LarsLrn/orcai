/** The newest revision, for a read two zedTokens bound that cannot be ordered. */
export const NEWEST_REVISION = Object.freeze({
	revision: "newest",
} as const);

/**
 * The revision an authorisation read must see: at least as fresh as a
 * zedToken, or the newest. Without one, SpiceDB answers from its cache.
 */
export type ReadRevision = string | typeof NEWEST_REVISION;
