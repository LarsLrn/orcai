import type { dbSchema } from "@orcai/db";

const MIN_TOKEN_RESERVATION = 512;
const DEFAULT_MAX_OUTPUT_TOKENS = 16_384;

const estimatePromptTokens = (messages: unknown[]): number => {
	const serialized = JSON.stringify(messages);
	// Approximation: 4 characters per token is usually conservative for latin text.
	return Math.ceil(serialized.length / 4);
};

export const estimateQuotaReservationAmount = (params: {
	meteringMode: (typeof dbSchema.provider.$inferSelect)["meteringMode"];
	/** The call's own output cap. */
	maxExpectedOutputTokens?: number;
	/** Lowers the default output cap for a call without its own. */
	modelMaxOutputTokens?: number | null;
	maxExpectedProviderRequests: number;
	messages: unknown[];
}) => {
	if (params.meteringMode === "requests") {
		return params.maxExpectedProviderRequests;
	}

	const estimatedPromptTokens = estimatePromptTokens(params.messages);
	const outputTokens =
		params.maxExpectedOutputTokens ??
		Math.min(
			DEFAULT_MAX_OUTPUT_TOKENS,
			params.modelMaxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
		);
	return Math.max(MIN_TOKEN_RESERVATION, estimatedPromptTokens + outputTokens);
};
