import { z } from "zod/v4";
import { pipelineFailureSchema } from "../shared/primitives/pipeline-status";

/** The endpoint the instance embeds repository files and search queries with; the key never leaves the server. */
export const embeddingSettingsSchema = z.object({
	/** The active generation: a new model starts another one. */
	generation: z.number().int().positive(),
	baseUrl: z.url(),
	model: z.string(),
	/** The length of the model's vectors, read from a test embedding. */
	dimensions: z.number().int().positive(),
	/** Text the model expects before every search query; empty for none. */
	queryPrefix: z.string(),
	/** Text the model expects before every passage; empty for none. */
	passagePrefix: z.string(),
	apiKeySet: z.boolean(),
});

export type EmbeddingSettings = z.infer<typeof embeddingSettingsSchema>;

export const instanceSettingsSchema = z.object({
	/** Null until an instance admin sets embeddings up. */
	embeddings: embeddingSettingsSchema.nullable(),
});

/** How far re-embedding got, counted without naming any file or repository. */
export const embeddingProgressSchema = z.object({
	generation: z.number().int().positive(),
	/** Files are re-embedded after a new setup until every one has settled. */
	rebuilding: z.boolean(),
	organizations: z.array(
		z.object({
			/** Null for repositories without a home organisation. */
			organizationId: z.string().nullable(),
			name: z.string().nullable(),
			embedded: z.number().int().nonnegative(),
			waiting: z.number().int().nonnegative(),
			failed: z.number().int().nonnegative(),
		}),
	),
	failures: z.array(
		z.object({
			failure: pipelineFailureSchema,
			count: z.number().int().positive(),
		}),
	),
	/** Failed files Retry failed embeds again. */
	retryable: z.number().int().nonnegative(),
	/** Distinct assets whose stored extraction is missing, which need preparing again. */
	preparable: z.number().int().nonnegative(),
});

export type EmbeddingProgress = z.infer<typeof embeddingProgressSchema>;
