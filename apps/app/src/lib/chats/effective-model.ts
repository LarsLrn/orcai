import type { BotSetup, ChatConfig, EffectiveModel } from "@orcai/schema";

/**
 * The model and generation settings a chat's next turn uses. A required bot
 * setup decides both, so its author's changes reach existing chats; otherwise
 * the chat's own config does, which a recommended setup only seeded.
 */
export const effectiveModel = (
	config: ChatConfig | null | undefined,
	setup: BotSetup | null,
): EffectiveModel => {
	if (setup?.strength === "required") {
		return {
			modelId: setup.model?.id ?? null,
			providerId: setup.model?.providerId ?? null,
			generation: setup.generation,
			source: "bot-required",
			botSetup: setup,
		};
	}

	return {
		modelId: config?.modelId ?? null,
		providerId: config?.providerId ?? null,
		generation: {
			temperature: config?.temperature,
			maxTokens: config?.maxTokens,
			topP: config?.topP,
			frequencyPenalty: config?.frequencyPenalty,
			presencePenalty: config?.presencePenalty,
		},
		source: "chat",
		botSetup: setup,
	};
};

/** What a new chat with the bot starts from: the setup's model and settings, then the requested ones unless required. */
export const seededConfig = (
	config: ChatConfig,
	setup: BotSetup | null,
): ChatConfig => {
	if (!setup) return config;
	const seed: ChatConfig = {
		...setup.generation,
		...(setup.model && {
			modelId: setup.model.id,
			providerId: setup.model.providerId,
		}),
	};
	return setup.strength === "required"
		? {
				...config,
				...seed,
			}
		: {
				...seed,
				...config,
			};
};
