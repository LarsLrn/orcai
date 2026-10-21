import type { dbSchema } from "@orcai/db";

const MIN_TOKEN_RESERVATION = 512;
const DEFAULT_MAX_OUTPUT_TOKENS = 16_384;

const estimatePromptTokens = (messages: unknown[]): number => {
	const serialized = JSON.stringify(messages);
	// Approximation: 4 characters per token is usually conservative for latin text.
	return Math.ceil(serialized.length / 4);
};

/** The output a call reserves room for: its own cap, else the default within the model's. */
export const reservedOutputTokens = ({
	maxExpectedOutputTokens,
	modelMaxOutputTokens,
}: {
	maxExpectedOutputTokens?: number;
	modelMaxOutputTokens?: number | null;
}) =>
	maxExpectedOutputTokens ??
	Math.min(
		DEFAULT_MAX_OUTPUT_TOKENS,
		modelMaxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
	);

export const estimateQuotaReservationAmount = (params: {
	meteringMode: (typeof dbSchema.provider.$inferSelect)["meteringMode"];
	/** The call's own output cap. */
	maxExpectedOutputTokens?: number;
	maxExpectedProviderRequests: number;
	messages: unknown[];
}) => {
	if (params.meteringMode === "requests") {
		return params.maxExpectedProviderRequests;
	}

	const estimatedPromptTokens = estimatePromptTokens(params.messages);
	const outputTokens = reservedOutputTokens(params);
	return Math.max(MIN_TOKEN_RESERVATION, estimatedPromptTokens + outputTokens);
};
