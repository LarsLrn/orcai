import { logErrorCause } from "@orcai/observability";
import { ORPCError } from "@orpc/client";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import { type AppRuntimeContext, runPromise } from "@/lib/effect/runtime";
import { isErrorReason } from "@/lib/errors/is-error-reason";

/**
 * A failed call as the model reads it: the reason code, then the server
 * message. Serialises to its text, which is what the model is sent.
 */
export class AssistantToolError extends Error {
	override readonly name = "AssistantToolError";

	toJSON() {
		return this.message;
	}
}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null;

const issuesText = (data: unknown) =>
	isRecord(data) && Array.isArray(data.issues)
		? data.issues
				.filter(isRecord)
				.map((issue) =>
					[
						Array.isArray(issue.path) ? issue.path.join(".") : undefined,
						issue.message,
					]
						.filter(Boolean)
						.join(": "),
				)
				.join("; ")
		: "";

/** `REASON: message`, with the code standing in for a missing reason. */
export const toolErrorText = (error: unknown): string => {
	if (error instanceof AssistantToolError) {
		return error.message;
	}

	if (error instanceof ORPCError) {
		const data: unknown = error.data;
		const reason =
			isRecord(data) && isErrorReason(data.reason) ? data.reason : error.code;

		if (error.code === "INTERNAL_SERVER_ERROR") {
			return `${reason}: The request failed on the server.`;
		}

		const message =
			error.cause instanceof Error && error.cause.message !== ""
				? error.cause.message
				: error.message;
		const issues = issuesText(data);

		return `${reason}: ${message}${issues ? ` (${issues})` : ""}`;
	}

	return "INTERNAL_SERVER_ERROR: The request failed on the server.";
};

/** Whether the server answered the call; anything else failed on the server. */
const isAnswered = (error: unknown): boolean =>
	error instanceof AssistantToolError
		? error.cause === undefined || isAnswered(error.cause)
		: error instanceof ORPCError && error.code !== "INTERNAL_SERVER_ERROR";

/**
 * Runs a tool's effect with the call's abort signal. A failure or defect
 * rejects with an `AssistantToolError`, which the SDK turns into the tool
 * error; one that failed on the server is logged and kept as its cause.
 */
export const runAssistantTool = <A, E>(
	effect: Effect.Effect<A, E, AppRuntimeContext>,
	abortSignal: AbortSignal | undefined,
): Promise<A> =>
	runPromise(
		effect.pipe(
			Effect.catchCause(
				(cause): Effect.Effect<never, E | AssistantToolError> => {
					if (Cause.hasInterruptsOnly(cause)) return Effect.failCause(cause);
					const error = Cause.squash(cause);
					const failed = Effect.fail(
						new AssistantToolError(toolErrorText(error), {
							cause: error,
						}),
					);
					return isAnswered(error)
						? failed
						: logErrorCause("Assistant tool failed", cause).pipe(
								Effect.andThen(failed),
							);
				},
			),
		),
		{
			signal: abortSignal,
		},
	);
