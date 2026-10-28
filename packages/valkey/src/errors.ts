import * as Data from "effect/Data";

export class ValkeyError extends Data.TaggedError("ValkeyError")<{
	readonly operation: "connect" | "probe";
	readonly cause: unknown;
}> {}
