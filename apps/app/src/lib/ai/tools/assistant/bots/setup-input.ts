import {
	botSetupStrengthSchema,
	generationSettingsSchema,
	modelIdSchema,
} from "@orcai/schema";
import { z } from "zod/v4";

export const setupInputSchema = z
	.strictObject({
		modelId: modelIdSchema.describe(
			"Id of a chat model of the active organisation, from findModels.",
		),
		strength: botSetupStrengthSchema
			.default("recommended")
			.describe(
				"recommended seeds new chats and lets people switch; required makes every chat use the model and settings, also existing ones.",
			),
		generation: z
			.strictObject(generationSettingsSchema.shape)
			.default({})
			.describe(
				"Optional temperature, topP, maxTokens, frequencyPenalty and presencePenalty; leave out to keep the provider's defaults.",
			),
	})
	.nullable()
	.describe(
		"The bot's model in the active organisation; null removes it so chats pick freely. Leave out to keep it.",
	);
