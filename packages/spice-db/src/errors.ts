import { status } from "@grpc/grpc-js";
import * as Data from "effect/Data";

const ErrorTags = {
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

/** The gRPC status name of a failed SpiceDB call, when it carries one. */
export const grpcStatusOf = (error: SpiceDbError) => {
	const code =
		typeof error.cause === "object" &&
		error.cause !== null &&
		"code" in error.cause
			? error.cause.code
			: undefined;
	return typeof code === "number" ? status[code] : undefined;
};

const UNAVAILABLE_STATUSES = new Set<string | undefined>([
	"UNAVAILABLE",
	"DEADLINE_EXCEEDED",
	"RESOURCE_EXHAUSTED",
]);

/** Whether SpiceDB could not be reached or did not answer in time, rather than rejecting the call. */
export const isUnavailable = (error: SpiceDbError) =>
	UNAVAILABLE_STATUSES.has(grpcStatusOf(error));
