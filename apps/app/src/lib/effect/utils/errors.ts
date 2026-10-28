import type { AiError } from "@orcai/ai";
import type { PgBossError } from "@orcai/pg-boss";
import type { ProcessError } from "@orcai/process";
import type { QdrantError } from "@orcai/qdrant";
import type { S3Error } from "@orcai/s3/server";
import type {
	AnyErrorParams,
	ErrorReason,
	ErrorReasonProps,
	NotFoundEntity,
} from "@orcai/schema";
import type { SpiceDbError } from "@orcai/spice-db";
import type { ValkeyError } from "@orcai/valkey";
import type { EffectDrizzleQueryError } from "drizzle-orm/effect-core/errors";
import * as Data from "effect/Data";
import type { SqlError } from "effect/sql";

export const ErrorTags = {
	// Resource errors
	NOT_FOUND: "NotFoundError",
	CONFLICT: "ConflictError",

	// Auth errors
	AUTHZ: "AuthzError",
	UNAUTHORIZED: "UnauthorizedError",
	FORBIDDEN: "ForbiddenError",

	// Validation errors
	VALIDATION: "ValidationError",
	BAD_REQUEST: "BadRequestError",

	// AI errors
	AI: "AiError",

	// Infrastructure errors
	PG_BOSS: "PgBossError",
	SPICE_DB: "SpiceDbError",
	S3: "S3Error",
	QDRANT: "QdrantError",
	VALKEY: "ValkeyError",
	PROCESS: "ProcessError",
	DRIZZLE_QUERY: "EffectDrizzleQueryError",
	SQL: "SqlError",

	// Catch-all for unexpected errors
	INTERNAL: "InternalError",
} as const;

// Resource / auth / validation errors
// Define concrete classes so `AppError` union is exhaustive at the type level.
// `message` is for logs only; the client receives `reason` and `params`.

export class NotFoundError extends Data.TaggedError(ErrorTags.NOT_FOUND)<{
	readonly reason?: ErrorReason;
	readonly entity?: NotFoundEntity;
	readonly id?: string;
	readonly message?: string;
	readonly cause?: unknown;
}> {}

export class UnauthorizedError extends Data.TaggedError(
	ErrorTags.UNAUTHORIZED,
)<{
	readonly reason?: ErrorReason;
	readonly message?: string;
	readonly cause?: unknown;
}> {}

class ValidationError extends Data.TaggedError(ErrorTags.VALIDATION)<{
	readonly message: string;
	readonly fields?: Record<string, string>;
	readonly cause?: unknown;
}> {}

// A class instance cannot be a union, so the reason-to-params link is enforced
// on the constructor and the instance carries the loose shape.
type ReasonCarrier = {
	readonly reason: ErrorReason;
	readonly params?: AnyErrorParams;
};

type ReasonedConstructor<Instance, Props> = (new (
	props: Props & ErrorReasonProps,
) => Instance) & {
	readonly prototype: Instance;
};

type ConflictProps = {
	readonly message?: string;
	readonly cause?: unknown;
};

class ConflictErrorClass extends Data.TaggedError(ErrorTags.CONFLICT)<
	ConflictProps & ReasonCarrier
> {}

export type ConflictError = ConflictErrorClass;
export const ConflictError = ConflictErrorClass as ReasonedConstructor<
	ConflictErrorClass,
	ConflictProps
>;

type ForbiddenData = {
	readonly permission?: string;
	readonly entityType?: string;
	readonly zedToken?: string;
};

type ForbiddenProps = {
	readonly message?: string;
	readonly data?: ForbiddenData;
	readonly cause?: unknown;
};

class ForbiddenErrorClass extends Data.TaggedError(ErrorTags.FORBIDDEN)<
	ForbiddenProps & ReasonCarrier
> {}

export type ForbiddenError = ForbiddenErrorClass;
export const ForbiddenError = ForbiddenErrorClass as ReasonedConstructor<
	ForbiddenErrorClass,
	ForbiddenProps
>;

type BadRequestProps = {
	readonly message: string;
	readonly cause?: unknown;
};

class BadRequestErrorClass extends Data.TaggedError(ErrorTags.BAD_REQUEST)<
	BadRequestProps & ReasonCarrier
> {}

export type BadRequestError = BadRequestErrorClass;
export const BadRequestError = BadRequestErrorClass as ReasonedConstructor<
	BadRequestErrorClass,
	BadRequestProps
>;

export class AuthzError extends Data.TaggedError(ErrorTags.AUTHZ)<{
	reason: "outbox_enqueue_failed" | "projection_failed";
	cause: unknown;
}> {}

export class InternalError extends Data.TaggedError(ErrorTags.INTERNAL)<{
	readonly operation: string;
	readonly cause: unknown;
}> {}

export type AppError =
	| SpiceDbError
	| PgBossError
	| NotFoundError
	| ConflictError
	| UnauthorizedError
	| ForbiddenError
	| ValidationError
	| BadRequestError
	| S3Error
	| QdrantError
	| ValkeyError
	| ProcessError
	| EffectDrizzleQueryError
	| SqlError.SqlError
	| AiError
	| AuthzError
	| InternalError;
