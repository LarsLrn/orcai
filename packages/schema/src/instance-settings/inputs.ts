import { z } from "zod/v4";

export const findInstanceSettingsInputSchema = z.object({});

export const findEmbeddingsStatusInputSchema = z.object({});

const endpointSchema = z.url().trim();

/** A blank key uses the stored one. */
const apiKeySchema = z
	.string()
	.trim()
	.optional()
	.transform((apiKey) => apiKey || undefined);

export const discoverEmbeddingModelsInputSchema = z.object({
	baseUrl: endpointSchema,
	apiKey: apiKeySchema,
});

export const updateEmbeddingSettingsInputSchema = z.object({
	baseUrl: endpointSchema,
	apiKey: apiKeySchema,
	model: z.string().trim().min(1),
	/**
	 * The active generation the admin confirmed replacing when the model or
	 * its dimensions change, which re-embeds every file. A save that replaced
	 * it meanwhile makes the change fail.
	 */
	reembedGeneration: z.number().int().positive().optional(),
});

export const findEmbeddingProgressInputSchema = z.object({});

export const reembedEmbeddingsInputSchema = z.object({
	/** The generation the admin saw; a repeated request finds it replaced and starts nothing. */
	generation: z.number().int().positive(),
});

export const retryFailedEmbeddingsInputSchema = z.object({});
