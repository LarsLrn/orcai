import * as Data from "effect/Data";

export const ErrorTags = {
	SPICE_DB: "SpiceDbError",
	SPICE_DB_CLI: "SpiceDbCliError",
} as const;

export class SpiceDbError extends Data.TaggedError(ErrorTags.SPICE_DB)<{
	readonly operation: "start" | "query" | "mutate" | "converge";
	readonly cause: unknown;
}> {}

export class SpiceDbCliError extends Data.TaggedError(ErrorTags.SPICE_DB_CLI)<{
	readonly message: string;
}> {}
