import * as Data from "effect/Data";

export const ErrorTags = {
	AI: "AiError",
	BAD_REQUEST: "BadRequestError",
} as const;

export class AiError extends Data.TaggedError(ErrorTags.AI)<{
	readonly operation: string;
	readonly cause: unknown;
}> {}

export class BadRequestError extends Data.TaggedError(ErrorTags.BAD_REQUEST)<{
	readonly message: string;
}> {}
