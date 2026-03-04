import * as Data from "effect/Data";
import type { JobQueue } from "@/lib/pg-boss/schema/job-queues";

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
	DOCLING: "DoclingError",

	// Infrastructure errors
	PG_BOSS: "PgBossError",
	PG_BOSS_WORKER: "PgBossWorkerError",
	SPICE_DB: "SpiceDbError",
	DATABASE: "DatabaseError",
	S3: "S3Error",
	QDRANT: "QdrantError",
	EMAIL: "EmailError",

	// Catch-all for unexpected errors
	INTERNAL: "InternalError",
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

export class DoclingError extends Data.TaggedError(ErrorTags.DOCLING)<{
	readonly operation: string;
	readonly cause: unknown;
}> {}

export class EmailError extends Data.TaggedError(ErrorTags.EMAIL)<{
	readonly operation: string;
	readonly cause: unknown;
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
	| AiError
	| DoclingError
	| EmailError
	| AuthzError
	| InternalError;

type S3LikeCause = {
	name?: string;
	code?: string;
	Code?: string;
	message?: string;
	$metadata?: {
		httpStatusCode?: number;
	};
};

const isS3LikeCause = (cause: unknown): cause is S3LikeCause =>
	cause !== null && typeof cause === "object";

const getS3StatusCode = (cause: unknown) =>
	isS3LikeCause(cause) ? cause.$metadata?.httpStatusCode : undefined;

const getS3Code = (cause: unknown) => {
	if (!isS3LikeCause(cause)) {
		return undefined;
	}

	if (typeof cause.Code === "string") {
		return cause.Code;
	}

	if (typeof cause.code === "string") {
		return cause.code;
	}

	if (typeof cause.name === "string") {
		return cause.name;
	}

	return undefined;
};

const getS3Message = (cause: unknown) =>
	isS3LikeCause(cause) && typeof cause.message === "string"
		? cause.message
		: undefined;

export const mapS3CauseToAppError = (params: {
	operation: string;
	cause: unknown;
	notFoundAs?: "not_found" | "bad_request";
}): AppError => {
	const statusCode = getS3StatusCode(params.cause);
	const code = getS3Code(params.cause);
	const message =
		getS3Message(params.cause) ??
		`Storage request failed at ${params.operation}.`;

	if (
		statusCode === 401 ||
		code === "InvalidAccessKeyId" ||
		code === "SignatureDoesNotMatch"
	) {
		return new UnauthorizedError({
			reason: message,
		});
	}

	if (statusCode === 403 || code === "AccessDenied") {
		return new ForbiddenError({
			reason: message,
		});
	}

	if (
		statusCode === 404 ||
		code === "NotFound" ||
		code === "NoSuchKey" ||
		code === "NoSuchUpload" ||
		code === "NoSuchBucket"
	) {
		if (params.notFoundAs === "bad_request") {
			return new BadRequestError({
				message,
			});
		}

		return new NotFoundError({
			entity: "storage_resource",
		});
	}

	if (
		statusCode === 409 ||
		code === "Conflict" ||
		code === "BucketAlreadyExists" ||
		code === "BucketAlreadyOwnedByYou"
	) {
		return new ConflictError({
			entity: "storage_resource",
			cause: params.cause,
		});
	}

	if (typeof statusCode === "number" && statusCode >= 400 && statusCode < 500) {
		return new BadRequestError({
			message,
		});
	}

	return new S3Error({
		operation: params.operation,
		cause: params.cause,
	});
};
