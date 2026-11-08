import * as Data from "effect/Data";

export class AiError extends Data.TaggedError("AiError")<{
	readonly operation: string;
	readonly cause: unknown;
}> {}
