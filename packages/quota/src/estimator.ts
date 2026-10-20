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
	maxExpectedOutputTokens?: number;
	maxExpectedProviderRequests: number;
	messages: unknown[];
}) => {
	if (params.meteringMode === "requests") {
		return params.maxExpectedProviderRequests;
	}

	const estimatedPromptTokens = estimatePromptTokens(params.messages);
	// Conservative fallback: prompt estimate + default output cap.
	return Math.max(
		MIN_TOKEN_RESERVATION,
		estimatedPromptTokens +
			(params.maxExpectedOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS),
	);
};
