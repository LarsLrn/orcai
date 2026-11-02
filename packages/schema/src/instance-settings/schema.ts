import { z } from "zod/v4";

/** The endpoint the instance embeds repository files and search queries with; the key never leaves the server. */
export const embeddingSettingsSchema = z.object({
	baseUrl: z.url(),
	model: z.string(),
	/** The length of the model's vectors, read from a test embedding. */
	dimensions: z.number().int().positive(),
	apiKeySet: z.boolean(),
});

export type EmbeddingSettings = z.infer<typeof embeddingSettingsSchema>;

export const instanceSettingsSchema = z.object({
	/** Null until an instance admin sets embeddings up. */
	embeddings: embeddingSettingsSchema.nullable(),
});

export type InstanceSettings = z.infer<typeof instanceSettingsSchema>;
