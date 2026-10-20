import type { ChatConfig } from "@orcai/schema";
import type { LanguageModelCallOptions } from "ai";

export type ChatCallSettings = Pick<
	LanguageModelCallOptions,
	| "temperature"
	| "maxOutputTokens"
	| "topP"
	| "frequencyPenalty"
	| "presencePenalty"
>;

/** Only what the config sets; the provider's defaults cover the rest. */
export const chatCallSettings = (
	config?: ChatConfig | null,
): ChatCallSettings => ({
	...(config?.temperature != null && {
		temperature: config.temperature,
	}),
	...(config?.maxTokens != null && {
		maxOutputTokens: config.maxTokens,
	}),
	...(config?.topP != null && {
		topP: config.topP,
	}),
	...(config?.frequencyPenalty != null && {
		frequencyPenalty: config.frequencyPenalty,
	}),
	...(config?.presencePenalty != null && {
		presencePenalty: config.presencePenalty,
	}),
});
