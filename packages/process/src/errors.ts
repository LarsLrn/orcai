import * as Data from "effect/Data";

export class ProcessError extends Data.TaggedError("ProcessError")<{
	readonly operation: string;
	readonly cause: unknown;
}> {}
