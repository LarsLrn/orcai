import * as OtelTracer from "@effect/opentelemetry/Tracer";
import { context as otelContext, trace } from "@opentelemetry/api";
import { ORPCError, type ORPCErrorCode } from "@orpc/client";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Match from "effect/Match";
import * as Option from "effect/Option";
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
	if (typeof error === "string" && error.length > 0) return error;
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

	if ("cause" in error) {
		const causeMessage = extractErrorMessage(error.cause);
		if (causeMessage && causeMessage !== "An error occurred") {
			return parts.length
				? `${parts.join(" ")}: ${causeMessage}`
				: causeMessage;
		}
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
		Match.tag("DatabaseError", () => "INTERNAL_SERVER_ERROR" as const),
		Match.tag("S3Error", () => "INTERNAL_SERVER_ERROR" as const),
		Match.tag("SpiceDbError", () => "INTERNAL_SERVER_ERROR" as const),
		Match.tag("QdrantError", () => "INTERNAL_SERVER_ERROR" as const),
		Match.tag("AiError", () => "INTERNAL_SERVER_ERROR" as const),
		Match.tag("InternalError", () => "INTERNAL_SERVER_ERROR" as const),
		Match.tag("DoclingError", () => "INTERNAL_SERVER_ERROR" as const),
		Match.tag("EmailError", () => "INTERNAL_SERVER_ERROR" as const),
		Match.tag("AuthzError", () => "INTERNAL_SERVER_ERROR" as const),
		Match.exhaustive,
	);

type AnyORPCError = ORPCError<ORPCErrorCode, unknown>;

const toAppORPCError = (error: AppError): AnyORPCError => {
	const status = appErrorToCode(error);
	const message = extractErrorMessage(error);
	return new ORPCError(status, {
		message,
		cause: error,
	});
};

const mapUnknownToORPCError = (error: unknown): AnyORPCError => {
	// Preserve already-shaped ORPC errors (e.g. from ORPC middleware),
	// so status, message and data are not flattened to INTERNAL_SERVER_ERROR.
	if (error instanceof ORPCError) {
		return error as AnyORPCError;
	}

	if (isAppError(error)) {
		return toAppORPCError(error);
	}

	const message = extractErrorMessage(error);
	return new ORPCError("INTERNAL_SERVER_ERROR", {
		message,
		cause: error,
	});
};

export const runOrpcEffect = <A, E, R extends AppRuntimeContext>(
	effect: Effect.Effect<A, E, R>,
	options?: {
		spanName?: string;
	},
): Promise<A> =>
	(async () => {
		const activeSpan = trace.getSpan(otelContext.active());

		const traced =
			activeSpan === undefined
				? effect
				: OtelTracer.withSpanContext(effect, activeSpan.spanContext());

		const named =
			options?.spanName === undefined
				? traced
				: Effect.withSpan(traced, options.spanName);

		const exit = await runtime.runPromiseExit(named);

		if (Exit.isSuccess(exit)) {
			return exit.value;
		}

		const failure = Cause.failureOption(exit.cause);
		if (Option.isSome(failure)) {
			throw mapUnknownToORPCError(failure.value);
		}

		const defect = Cause.dieOption(exit.cause);
		if (Option.isSome(defect)) {
			throw mapUnknownToORPCError(defect.value);
		}

		throw new ORPCError("INTERNAL_SERVER_ERROR", {
			message: "Internal server error",
		});
	})();
