import * as Data from "effect/Data";

export const ErrorTags = {
	AI: "AiError",
} as const;

export class AiError extends Data.TaggedError(ErrorTags.AI)<{
	readonly operation: string;
	readonly cause: unknown;
}> {}
