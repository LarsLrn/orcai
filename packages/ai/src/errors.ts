import * as Data from "effect/Data";

const ErrorTags = {
	AI: "AiError",
	QUOTA_DENIED: "QuotaDeniedError",
} as const;

export class AiError extends Data.TaggedError(ErrorTags.AI)<{
	readonly operation: string;
	readonly cause: unknown;
}> {}

/** The quota refused a metered call before it started. */
export class QuotaDeniedError extends Data.TaggedError(ErrorTags.QUOTA_DENIED)<{
	readonly reason:
		| "QUOTA_POOL_UNAVAILABLE"
		| "QUOTA_EXHAUSTED"
		| "QUOTA_CHECK_FAILED";
	readonly message: string;
}> {}
