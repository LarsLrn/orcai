import * as Data from "effect/Data";

const ErrorTags = {
	AI: "AiError",
} as const;

export class AiError extends Data.TaggedError(ErrorTags.AI)<{
	readonly operation: string;
	readonly cause: unknown;
}> {}
