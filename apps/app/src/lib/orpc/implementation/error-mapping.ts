import { logFailure } from "@orcai/observability";
import {
	COMMON_ERROR_STATUS_MAP,
	ORPCError,
	type ORPCErrorCode,
} from "@orpc/server";
import { isAbortError } from "@orpc/shared";
import { EffectDrizzleQueryError } from "drizzle-orm/effect-core";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Result from "effect/Result";
import { SqlError } from "effect/sql";
import { type AppError, ErrorTags } from "@/lib/effect/utils/errors";

type AnyORPCError = ORPCError<ORPCErrorCode, unknown>;

const APP_ERROR_TAGS = new Set<string>(Object.values(ErrorTags));

const isAppError = (error: unknown): error is AppError => {
	return (
		error !== null &&
		typeof error === "object" &&
		"_tag" in error &&
		typeof error._tag === "string" &&
		APP_ERROR_TAGS.has(error._tag)
	);
};

/** The violated constraint when `error` is a unique violation. */
export const uniqueViolationConstraint = (
	error: unknown,
): string | undefined => {
	const failure =
		error instanceof EffectDrizzleQueryError && Cause.isCause(error.cause)
			? Cause.squash(error.cause)
			: error;

	return failure instanceof SqlError.SqlError &&
		failure.reason._tag === "UniqueViolation"
		? failure.reason.constraint
		: undefined;
};

// Only the reason, its params and the typed data cross the wire. The English
// `message` on an AppError stays in logs.
const appErrorToORPCError = (error: AppError): AnyORPCError => {
	switch (error._tag) {
		case ErrorTags.NOT_FOUND:
			return new ORPCError("NOT_FOUND", {
				data: {
					reason: error.reason,
					entity: error.entity,
				},
				cause: error,
			});
		case ErrorTags.UNAUTHORIZED:
			return new ORPCError("UNAUTHORIZED", {
				data: {
					reason: error.reason,
				},
				cause: error,
			});
		case ErrorTags.FORBIDDEN:
			return new ORPCError("FORBIDDEN", {
				data: {
					...error.data,
					allowed: false,
					reason: error.reason,
					params: error.params,
				},
				cause: error,
			});
		case ErrorTags.BAD_REQUEST:
			return new ORPCError("BAD_REQUEST", {
				data: {
					reason: error.reason,
					params: error.params,
				},
				cause: error,
			});
		case ErrorTags.QUOTA_DENIED:
			return new ORPCError("BAD_REQUEST", {
				data: {
					reason: error.reason,
				},
				cause: error,
			});
		case ErrorTags.VALIDATION:
			return new ORPCError("BAD_REQUEST", {
				data: {},
				cause: error,
			});
		case ErrorTags.CONFLICT:
			return new ORPCError("CONFLICT", {
				data: {
					reason: error.reason,
					params: error.params,
				},
				cause: error,
			});
		case ErrorTags.DRIZZLE_QUERY:
		case ErrorTags.SQL:
			return uniqueViolationConstraint(error) !== undefined
				? new ORPCError("CONFLICT", {
						data: {
							reason: "ALREADY_EXISTS",
						},
						cause: error,
					})
				: new ORPCError("INTERNAL_SERVER_ERROR", {
						cause: error,
					});
		default:
			return new ORPCError("INTERNAL_SERVER_ERROR", {
				cause: error,
			});
	}
};

const unknownToORPCError = (error: unknown): AnyORPCError => {
	if (error instanceof ORPCError) {
		return error as AnyORPCError;
	}

	if (isAppError(error)) {
		return appErrorToORPCError(error);
	}

	return new ORPCError("INTERNAL_SERVER_ERROR", {
		cause: error,
	});
};

/** Whether the RPC handler answers `code` with a 4xx status; codes it has no status for get 500. */
export const isClientErrorCode = (code: string): boolean =>
	Object.hasOwn(COMMON_ERROR_STATUS_MAP, code) &&
	COMMON_ERROR_STATUS_MAP[code as keyof typeof COMMON_ERROR_STATUS_MAP] < 500;

/** A defect wins over failures alongside it, so the request answers 500. */
const causeToORPCError = (cause: Cause.Cause<unknown>): AnyORPCError => {
	const defect = Cause.findDefect(cause);
	if (Result.isSuccess(defect)) {
		return unknownToORPCError(defect.success);
	}

	const failure = Cause.findErrorOption(cause);
	if (Option.isSome(failure)) {
		return unknownToORPCError(failure.value);
	}

	return new ORPCError("INTERNAL_SERVER_ERROR", {
		cause: Cause.pretty(cause),
	});
};

/**
 * Fails with the cause's ORPCError, keeping interruptions and client aborts.
 * Idempotent, as a failure passes through the `effect/wrap` of every layer.
 */
export const mapEffectErrors = <A, E>(
	effect: Effect.Effect<A, E>,
): Effect.Effect<A, E> =>
	effect.pipe(
		Effect.catchCause((cause) =>
			Cause.hasInterruptsOnly(cause) || isAbortError(Cause.squash(cause))
				? Effect.failCause(cause)
				: Effect.fail(causeToORPCError(cause) as E),
		),
	);

/** Logs a failed procedure: client errors at info, everything else at error, client aborts not at all. */
export const logProcedureError = (error: unknown): Effect.Effect<void> => {
	if (isAbortError(error)) {
		return Effect.void;
	}

	const orpcError = unknownToORPCError(error);
	return logFailure("ORPC procedure failed", orpcError.cause ?? orpcError, {
		expected: isClientErrorCode(orpcError.code),
	}).pipe(
		Effect.annotateLogs({
			"orpc.error.code": orpcError.code,
		}),
	);
};
