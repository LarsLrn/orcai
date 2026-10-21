import { z } from "zod/v4";
import { providerIdSchema } from "../provider/ref";
import { searchFilterSchema } from "../shared/filters";
import { modelCapabilitiesSchema } from "./parts/capabilities";
import { modelIdSchema } from "./ref";

const tokenCountSchema = z.int32().positive();

/** What a model takes and writes at most; null when unknown. */
export const modelTokenLimitsSchema = z.object({
	contextWindow: tokenCountSchema.nullable(),
	maxOutputTokens: tokenCountSchema.nullable(),
});

export const modelFieldsSchema = z.object({
	providerModelId: z.string(),
	name: z.string(),
	description: z.string().max(500),
	isDeprecated: z.boolean(),
	capabilities: z.array(modelCapabilitiesSchema),
	...modelTokenLimitsSchema.partial().shape,
});

export const modelMutableFieldsSchema = modelFieldsSchema.partial();

export const modelSchema = modelFieldsSchema.extend({
	id: modelIdSchema,
	providerId: providerIdSchema,
	createdAt: z.coerce.date().nullable(),
	updatedAt: z.coerce.date().nullable(),
	...modelTokenLimitsSchema.shape,
});

export const modelFiltersSchema = z.object({
	providerId: providerIdSchema.optional(),
	capabilities: z.array(modelCapabilitiesSchema).optional(),
	isDeprecated: z.boolean().optional(),
	providerEnabled: z.boolean().optional(),
	...searchFilterSchema.shape,
});

export type Model = z.infer<typeof modelSchema>;
export type ModelTokenLimits = z.infer<typeof modelTokenLimitsSchema>;
