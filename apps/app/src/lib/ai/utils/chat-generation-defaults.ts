import type { ChatConfig } from "@orcai/schema";

export const DEFAULT_CHAT_GENERATION_PARAMS = {
	temperature: 0.7,
	topP: 1,
	frequencyPenalty: 0,
	presencePenalty: 0,
} as const;

export const resolveChatGenerationParams = (
	chatConfig?: ChatConfig | null,
) => ({
	temperature:
		chatConfig?.temperature ?? DEFAULT_CHAT_GENERATION_PARAMS.temperature,
	maxTokens: chatConfig?.maxTokens,
	topP: chatConfig?.topP ?? DEFAULT_CHAT_GENERATION_PARAMS.topP,
	frequencyPenalty:
		chatConfig?.frequencyPenalty ??
		DEFAULT_CHAT_GENERATION_PARAMS.frequencyPenalty,
	presencePenalty:
		chatConfig?.presencePenalty ??
		DEFAULT_CHAT_GENERATION_PARAMS.presencePenalty,
});
