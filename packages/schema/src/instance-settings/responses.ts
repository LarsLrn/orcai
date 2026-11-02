import { z } from "zod/v4";
import { createDataResponseSchema } from "../shared";
import {
	embeddingProgressSchema,
	embeddingSettingsSchema,
	instanceSettingsSchema,
} from "./schema";

export const findInstanceSettingsResponseSchema = createDataResponseSchema(
	instanceSettingsSchema,
);

export const findEmbeddingsStatusResponseSchema = createDataResponseSchema(
	z.object({
		configured: z.boolean(),
		/** Search finds only the files already re-embedded. */
		rebuilding: z.boolean(),
	}),
);

/** The endpoint's model ids; empty when it offers no list. */
export const discoverEmbeddingModelsResponseSchema = createDataResponseSchema(
	z.object({
		models: z.array(z.string()),
		listed: z.boolean(),
	}),
);

export const updateEmbeddingSettingsResponseSchema = createDataResponseSchema(
	embeddingSettingsSchema,
);

/** Null before embeddings are set up. */
export const findEmbeddingProgressResponseSchema = createDataResponseSchema(
	embeddingProgressSchema.nullable(),
);

export const reembedEmbeddingsResponseSchema = createDataResponseSchema(
	z.object({
		started: z.boolean(),
	}),
);

export const retryFailedEmbeddingsResponseSchema = createDataResponseSchema(
	z.object({
		admitted: z.number().int().nonnegative(),
	}),
);

export const prepareMissingExtractionsAgainResponseSchema =
	createDataResponseSchema(
		z.object({
			assets: z.number().int().nonnegative(),
		}),
	);
