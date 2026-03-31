import * as Data from "effect/Data";

export class ValkeyError extends Data.TaggedError("ValkeyError")<{
	readonly operation: "connect";
	readonly cause: unknown;
}> {}
