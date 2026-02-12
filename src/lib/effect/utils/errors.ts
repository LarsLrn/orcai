import * as Data from "effect/Data";
import type { JobQueue } from "@/lib/pg-boss/schema/job";

export const ErrorTags = {
	// Resource errors
	NOT_FOUND: "NotFoundError",
	CONFLICT: "ConflictError",

	// Auth errors
	UNAUTHORIZED: "UnauthorizedError",
	FORBIDDEN: "ForbiddenError",

	// Validation errors
	VALIDATION: "ValidationError",
	BAD_REQUEST: "BadRequestError",

	// AI errors
	AI: "AiError",

	// Infrastructure errors
	PG_BOSS: "PgBossError",
	PG_BOSS_WORKER: "PgBossWorkerError",
	SPICE_DB: "SpiceDbError",
	DATABASE: "DatabaseError",
	S3: "S3Error",
	QDRANT: "QdrantError",
} as const;

export class SpiceDbError extends Data.TaggedError(ErrorTags.SPICE_DB)<{
	readonly operation: "start" | "query" | "mutate";
	readonly cause: unknown;
}> {}

export class PgBossError extends Data.TaggedError(ErrorTags.PG_BOSS)<{
	readonly operation:
		| "start"
		| "stop"
		| "run"
		| "query"
		| "send"
		| "cancel"
		| "pause"
		| "resume";
	readonly queue?: JobQueue;
	readonly jobId?: string;
	readonly cause: unknown;
}> {}

export class PgBossWorkersError extends Data.TaggedError(
	ErrorTags.PG_BOSS_WORKER,
)<{
	readonly queue: JobQueue;
	readonly step: "create-queue" | "register-worker" | "run-worker";
	readonly jobId?: string;
	readonly cause: unknown;
}> {}

// Resource / auth / validation errors
// Define concrete classes so `AppError` union is exhaustive at the type level.

export class NotFoundError extends Data.TaggedError(ErrorTags.NOT_FOUND)<{
	readonly entity: string;
	readonly id?: string;
}> {}

export class ConflictError extends Data.TaggedError(ErrorTags.CONFLICT)<{
	readonly entity: string;
	readonly cause?: unknown;
}> {}

export class UnauthorizedError extends Data.TaggedError(
	ErrorTags.UNAUTHORIZED,
)<{
	readonly reason?: string;
}> {}

export class ForbiddenError extends Data.TaggedError(ErrorTags.FORBIDDEN)<{
	readonly reason?: string;
}> {}

export class ValidationError extends Data.TaggedError(ErrorTags.VALIDATION)<{
	readonly message: string;
	readonly fields?: Record<string, string>;
}> {}

export class BadRequestError extends Data.TaggedError(ErrorTags.BAD_REQUEST)<{
	readonly message: string;
}> {}

export class DatabaseError extends Data.TaggedError(ErrorTags.DATABASE)<{
	readonly operation: string;
	readonly cause: unknown;
}> {}

export class S3Error extends Data.TaggedError(ErrorTags.S3)<{
	readonly operation: string;
	readonly cause: unknown;
}> {}

export class QdrantError extends Data.TaggedError(ErrorTags.QDRANT)<{
	readonly operation: string;
	readonly cause: unknown;
}> {}

export class AiError extends Data.TaggedError(ErrorTags.AI)<{
	readonly operation: string;
	readonly cause: unknown;
}> {}

export type AppError =
	| SpiceDbError
	| PgBossError
	| PgBossWorkersError
	| NotFoundError
	| ConflictError
	| UnauthorizedError
	| ForbiddenError
	| ValidationError
	| BadRequestError
	| DatabaseError
	| S3Error
	| QdrantError
	| AiError;
