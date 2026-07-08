import type { AiError } from "@orcai/ai";
import type { PgBossError } from "@orcai/pg-boss";
import type { ProcessError } from "@orcai/process";
import type { QdrantError } from "@orcai/qdrant";
import type { QuotaCounterStoreError } from "@orcai/quota";
import type { S3Error } from "@orcai/s3/server";
import type { SpiceDbError } from "@orcai/spice-db";
import type { ValkeyError } from "@orcai/valkey";
import type { EffectDrizzleQueryError } from "drizzle-orm/effect-core/errors";
import * as Data from "effect/Data";
import type { SqlError } from "effect/unstable/sql/SqlError";

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
	QUOTA_COUNTER_STORE: "QuotaCounterStoreError",
	VALKEY: "ValkeyError",
	PROCESS: "ProcessError",
	DRIZZLE_QUERY: "EffectDrizzleQueryError",
	SQL: "SqlError",

	// Catch-all for unexpected errors
	INTERNAL: "InternalError",
} as const;

// Resource / auth / validation errors
// Define concrete classes so `AppError` union is exhaustive at the type level.

export class NotFoundError extends Data.TaggedError(ErrorTags.NOT_FOUND)<{
	readonly entity?: string;
	readonly id?: string;
	readonly message?: string;
	readonly data?: unknown;
	readonly cause?: unknown;
}> {}

export class ConflictError extends Data.TaggedError(ErrorTags.CONFLICT)<{
	readonly entity?: string;
	readonly message?: string;
	readonly data?: unknown;
	readonly cause?: unknown;
}> {}

export class UnauthorizedError extends Data.TaggedError(
	ErrorTags.UNAUTHORIZED,
)<{
	readonly message?: string;
	readonly reason?: string;
	readonly data?: unknown;
	readonly cause?: unknown;
}> {}

export class ForbiddenError extends Data.TaggedError(ErrorTags.FORBIDDEN)<{
	readonly message?: string;
	readonly reason?: string;
	readonly data?: unknown;
	readonly cause?: unknown;
}> {}

export class ValidationError extends Data.TaggedError(ErrorTags.VALIDATION)<{
	readonly message: string;
	readonly fields?: Record<string, string>;
	readonly data?: unknown;
	readonly cause?: unknown;
}> {}

export class BadRequestError extends Data.TaggedError(ErrorTags.BAD_REQUEST)<{
	readonly message: string;
	readonly data?: unknown;
	readonly cause?: unknown;
}> {}

export class AuthzError extends Data.TaggedError(ErrorTags.AUTHZ)<{
	reason:
		| "outbox_enqueue_failed"
		| "projection_failed"
		| "outbox_finalize_failed";
	eventId?: string;
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
	| QuotaCounterStoreError
	| ValkeyError
	| ProcessError
	| EffectDrizzleQueryError
	| SqlError
	| AiError
	| AuthzError
	| InternalError;
