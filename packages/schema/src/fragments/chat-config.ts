import { z } from "zod/v4";
import { modelIdSchema } from "../model/ref";
import { providerIdSchema } from "../provider/ref";

export const chatConfigSchema = z.object({
	modelId: modelIdSchema.optional(),
	providerId: providerIdSchema.optional(),
	systemPrompt: z.string().optional(),
	temperature: z.number().min(0).max(2).optional(),
	maxTokens: z.number().int().min(1).optional(),
	topP: z.number().min(0).max(1).optional(),
	frequencyPenalty: z.number().min(-2).max(2).optional(),
	presencePenalty: z.number().min(-2).max(2).optional(),
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
});

export type ChatConfig = z.infer<typeof chatConfigSchema>;
export type ChatConfigPatch = z.infer<typeof chatConfigPatchSchema>;
