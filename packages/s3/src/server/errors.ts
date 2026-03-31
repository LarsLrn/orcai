import * as Data from "effect/Data";

export class S3Error extends Data.TaggedError("S3Error")<{
	readonly operation: string;
	readonly cause: unknown;
}> {}
