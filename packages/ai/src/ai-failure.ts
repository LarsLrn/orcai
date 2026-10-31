import type { PipelineFailure } from "@orcai/schema";
import { NoObjectGeneratedError } from "ai";
import type { AiError } from "./errors";

/** What the reply of a failed call says, or undefined when the provider gave none. */
export const failedReply = (error: AiError) => {
	const { cause } = error;
	if (!NoObjectGeneratedError.isInstance(cause)) return undefined;
	return {
		finishReason: cause.finishReason,
		inputTokens: cause.usage?.inputTokens,
		outputTokens: cause.usage?.outputTokens,
		reasoningTokens: cause.usage?.outputTokenDetails.reasoningTokens,
	};
};

/** Why a call failed: the provider erred, its answer did not fit, or the answer was cut off at its budget. */
export const aiFailure = (
	error: AiError,
): Extract<PipelineFailure, "model" | "answer" | "output_limit"> => {
	const reply = failedReply(error);
	if (!reply) return "model";
	return reply.finishReason === "length" ? "output_limit" : "answer";
};
