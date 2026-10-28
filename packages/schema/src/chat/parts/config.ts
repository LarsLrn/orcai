import { z } from "zod/v4";
import { chatFeaturesSchema } from "../../feature/schema";
import { modelIdSchema } from "../../model/ref";
import { providerIdSchema } from "../../provider/ref";

/** Call options of a chat or a bot setup; unset ones keep the provider's defaults. */
export const generationSettingsSchema = z.object({
	temperature: z.number().min(0).max(2).optional(),
	maxTokens: z.number().int().min(1).optional(),
	topP: z.number().min(0).max(1).optional(),
	frequencyPenalty: z.number().min(-2).max(2).optional(),
	presencePenalty: z.number().min(-2).max(2).optional(),
});

export const chatConfigSchema = generationSettingsSchema.extend({
	modelId: modelIdSchema.optional(),
	providerId: providerIdSchema.optional(),
	systemPrompt: z.string().optional(),
	features: chatFeaturesSchema.optional(),
});

export const chatConfigPatchSchema = z.object({
	modelId: modelIdSchema.nullable().optional(),
	providerId: providerIdSchema.nullable().optional(),
	systemPrompt: z.string().nullable().optional(),
	temperature: z.number().min(0).max(2).nullable().optional(),
	maxTokens: z.number().int().min(1).nullable().optional(),
	topP: z.number().min(0).max(1).nullable().optional(),
	frequencyPenalty: z.number().min(-2).max(2).nullable().optional(),
	presencePenalty: z.number().min(-2).max(2).nullable().optional(),
	features: chatFeaturesSchema.nullable().optional(),
});

export type GenerationSettings = z.infer<typeof generationSettingsSchema>;
export type ChatConfig = z.infer<typeof chatConfigSchema>;
export type ChatConfigPatch = z.infer<typeof chatConfigPatchSchema>;
