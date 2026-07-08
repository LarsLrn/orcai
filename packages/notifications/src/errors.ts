import * as Data from "effect/Data";

export class EmailError extends Data.TaggedError("EmailError")<{
	readonly operation: string;
	readonly cause: unknown;
}> {}
