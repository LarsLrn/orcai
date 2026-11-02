import { z } from "zod/v4";
import { createDataResponseSchema } from "../shared";
import { embeddingSettingsSchema, instanceSettingsSchema } from "./schema";

export const findInstanceSettingsResponseSchema = createDataResponseSchema(
	instanceSettingsSchema,
);

export const findEmbeddingsStatusResponseSchema = createDataResponseSchema(
	z.object({
		configured: z.boolean(),
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
