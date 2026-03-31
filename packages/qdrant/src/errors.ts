import * as Data from "effect/Data";

export class QdrantError extends Data.TaggedError("QdrantError")<{
	readonly operation: string;
	readonly cause: unknown;
}> {}
