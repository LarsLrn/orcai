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
});
