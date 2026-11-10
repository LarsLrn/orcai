import { z } from "zod/v4";
import { activityRunIdSchema } from "../shared/ids";
import { createDataResponseSchema } from "../shared/responses";
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

export const prepareAssetsAgainResponseSchema = createDataResponseSchema(
	z.object({
		assets: z.number().int().nonnegative(),
		/** The run preparing them again, null when there is nothing to prepare. */
		runId: activityRunIdSchema.nullable(),
		/** Whether the request joined a run already in progress. */
		joined: z.boolean(),
	}),
);
