import { z } from "zod/v4";
import { generationSettingsSchema } from "../chat/parts/config";
import { modelIdSchema } from "../model/ref";
import { providerIdSchema } from "../provider/ref";
import { resourcePrincipalSchema } from "../resource/schema";

/** Recommended seeds new chats; required decides every turn of the bot's chats. */
export const botSetupStrengthSchema = z.enum([
	"recommended",
	"required",
]);

export const botSetupFieldsSchema = z.object({
	modelId: modelIdSchema,
	strength: botSetupStrengthSchema,
	generation: generationSettingsSchema,
});

/** A bot's setup in one organisation; its model is null once deleted. */
export const botSetupSchema = z.object({
	model: z
		.object({
			id: modelIdSchema,
			name: z.string(),
			providerId: providerIdSchema,
			/** Whether turns can use it: provider enabled, not deprecated, tool calling. */
			usable: z.boolean(),
		})
		.nullable(),
	strength: botSetupStrengthSchema,
	generation: generationSettingsSchema,
});

/** Whether a principal the bot is shared with has a quota pool for the model. */
export const botSetupCoverageSchema = z.object({
	principals: z.array(
		z.object({
			principal: resourcePrincipalSchema,
			covered: z.boolean(),
		}),
	),
});

export type BotSetupStrength = z.infer<typeof botSetupStrengthSchema>;
export type BotSetupFields = z.infer<typeof botSetupFieldsSchema>;
export type BotSetup = z.infer<typeof botSetupSchema>;
export type BotSetupCoverage = z.infer<typeof botSetupCoverageSchema>;
