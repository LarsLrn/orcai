import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Result from "effect/Result";

const extractErrorTag = (error: unknown): string => {
	if (
		error != null &&
		typeof error === "object" &&
		"_tag" in error &&
		typeof error._tag === "string"
	) {
		return error._tag;
	}
	return "unknown";
};

const extractErrorMessage = (error: unknown): string => {
	if (error instanceof Error) return error.message;
	if (
		error != null &&
		typeof error === "object" &&
		"message" in error &&
		typeof error.message === "string"
	) {
		return error.message;
	}
	return String(error ?? "unknown");
};

const extractCauseType = (cause: Cause.Cause<unknown>): string => {
	if (cause.reasons.length === 0) {
		return "Empty";
	}

	return Array.from(new Set(cause.reasons.map((reason) => reason._tag))).join(
		"+",
	);
};

/**
 * Logs an Effect `Cause` with structured OTel-friendly annotations.
 *
 * Emitted attributes:
 * - `error.type`    – the `Cause` reason type(s) (`Fail`, `Die`, `Interrupt`, …)
 * - `error.tag`     – the `_tag` of the inner error value, if present
 * - `error.message` – a short human-readable message
 * - `error.cause`   – full `Cause.pretty` output for debugging
 */
export const logErrorCause = (
	message: string,
	cause: Cause.Cause<unknown>,
): Effect.Effect<void> => {
	const failure = Cause.findErrorOption(cause);
	const defect = Cause.findDefect(cause);
	const error = Option.isSome(failure)
		? failure.value
		: Result.isSuccess(defect)
			? defect.success
			: undefined;

	return Effect.logError(message).pipe(
		Effect.annotateLogs({
			"error.type": extractCauseType(cause),
			"error.tag": extractErrorTag(error),
			"error.message": extractErrorMessage(error),
			"error.cause": Cause.pretty(cause),
		}),
	);
};
