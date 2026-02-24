import * as OtelTracer from "@effect/opentelemetry/Tracer";
import { context as otelContext, trace } from "@opentelemetry/api";
import { ORPCError, type ORPCErrorCode } from "@orpc/client";
import * as Effect from "effect/Effect";
import * as Match from "effect/Match";
import { type AppRuntimeContext, runtime } from "@/lib/effect/runtime";
import { type AppError, ErrorTags } from "./errors";

/**
 * Type guard for errors belonging to the `AppError` union.
 * Checks that the `_tag` is one of the known application error tags.
 */
const APP_ERROR_TAGS = new Set<string>(Object.values(ErrorTags));

function isAppError(error: unknown): error is AppError {
	return (
		error !== null &&
		typeof error === "object" &&
		"_tag" in error &&
		typeof error._tag === "string" &&
		APP_ERROR_TAGS.has(error._tag)
	);
}

/**
 * Extracts a human-readable error message from an error.
 */
function extractErrorMessage(error: unknown): string {
	if (!error || typeof error !== "object") return "An error occurred";

	const parts: string[] = [];

	if ("_tag" in error && typeof error._tag === "string") {
		parts.push(error._tag);
	}

	if ("operation" in error && typeof error.operation === "string") {
		parts.push(`at ${error.operation}`);
	}

	if ("step" in error && typeof error.step === "string") {
		parts.push(`at ${error.step}`);
	}

	if ("entity" in error && typeof error.entity === "string") {
		parts.push(`(${error.entity})`);
	}

	if ("message" in error && typeof error.message === "string") {
		return parts.length
			? `${parts.join(" ")}: ${error.message}`
			: error.message;
	}

	if ("reason" in error && typeof error.reason === "string") {
		return parts.length ? `${parts.join(" ")}: ${error.reason}` : error.reason;
	}

	return parts.length ? parts.join(" ") : "An error occurred";
}

/**
 * Type-safe, exhaustive mapping from `AppError` to ORPC status codes.
 * Uses Effect's `Match` module — adding a new variant to `AppError`
 * will cause a compile error until a case is added here.
 */
const appErrorToCode: (error: AppError) => ORPCErrorCode =
	Match.type<AppError>().pipe(
		Match.tag("NotFoundError", () => "NOT_FOUND" as const),
		Match.tag("UnauthorizedError", () => "UNAUTHORIZED" as const),
		Match.tag("ForbiddenError", () => "FORBIDDEN" as const),
		Match.tag("BadRequestError", () => "BAD_REQUEST" as const),
		Match.tag("ValidationError", () => "BAD_REQUEST" as const),
		Match.tag("ConflictError", () => "CONFLICT" as const),
		Match.tag("PgBossError", () => "INTERNAL_SERVER_ERROR" as const),
		Match.tag("PgBossWorkerError", () => "INTERNAL_SERVER_ERROR" as const),
		Match.tag("DatabaseError", () => "INTERNAL_SERVER_ERROR" as const),
		Match.tag("S3Error", () => "INTERNAL_SERVER_ERROR" as const),
		Match.tag("SpiceDbError", () => "INTERNAL_SERVER_ERROR" as const),
		Match.tag("QdrantError", () => "INTERNAL_SERVER_ERROR" as const),
		Match.tag("AiError", () => "INTERNAL_SERVER_ERROR" as const),
		Match.tag("InternalError", () => "INTERNAL_SERVER_ERROR" as const),
		Match.tag("DoclingError", () => "INTERNAL_SERVER_ERROR" as const),
		Match.tag("EmailError", () => "INTERNAL_SERVER_ERROR" as const),
		Match.exhaustive,
	);

type AnyORPCError = ORPCError<ORPCErrorCode, unknown>;
const toORPCError = (error: AppError): AnyORPCError => {
	const status = appErrorToCode(error);
	const message = extractErrorMessage(error);
	return new ORPCError(status, { data: { message } });
};

/**
 * Pipeable operator that maps Effect errors to ORPCError.
 *
 * For errors in the `AppError` union, status codes are derived with
 * exhaustive matching. External errors (e.g. `EffectDrizzleQueryError`)
 * fall back to `INTERNAL_SERVER_ERROR`.
 *
 * @example
 * ```ts
 * await runtime.runPromise(
 *   sendJobBatchEffect(...).pipe(mapToORPCError()),
 * );
 * ```
 */
const mapToORPCError = <E>() =>
	Effect.mapError<E, AnyORPCError>((error) => {
		// Preserve already-shaped ORPC errors (e.g. from ORPC middleware),
		// so status, message and data are not flattened to INTERNAL_SERVER_ERROR.
		if (error instanceof ORPCError) {
			return error as AnyORPCError;
		}

		if (isAppError(error)) {
			return toORPCError(error);
		}

		const message = extractErrorMessage(error);
		return new ORPCError("INTERNAL_SERVER_ERROR", { data: { message } });
	});

export const runOrpcEffect = <A, E, R extends AppRuntimeContext>(
	effect: Effect.Effect<A, E, R>,
	options?: { spanName?: string },
): Promise<A> => {
	const activeSpan = trace.getSpan(otelContext.active());

	const traced =
		activeSpan === undefined
			? effect
			: OtelTracer.withSpanContext(effect, activeSpan.spanContext());

	const named =
		options?.spanName === undefined
			? traced
			: Effect.withSpan(traced, options.spanName);

	return runtime.runPromise(named.pipe(mapToORPCError<E>()));
};
