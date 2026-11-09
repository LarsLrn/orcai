import type { ChatConfig, ModelTokenLimits } from "@orcai/schema";
import type { LanguageModelCallOptions } from "ai";

export type ChatCallSettings = Pick<
	LanguageModelCallOptions,
	| "temperature"
	| "maxOutputTokens"
	| "topP"
	| "frequencyPenalty"
	| "presencePenalty"
>;

/**
 * Only what the config sets; the provider's defaults cover the rest. Max
 * tokens stay within the model's max output, which a later model switch or
 * edit may have lowered.
 */
export const chatCallSettings = (
	config?: ChatConfig | null,
	{ maxOutputTokens }: Pick<ModelTokenLimits, "maxOutputTokens"> = {
		maxOutputTokens: null,
	},
): ChatCallSettings => ({
	...(config?.temperature != null && {
		temperature: config.temperature,
	}),
	...(config?.maxTokens != null && {
		maxOutputTokens: Math.min(
			config.maxTokens,
			maxOutputTokens ?? config.maxTokens,
		),
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
