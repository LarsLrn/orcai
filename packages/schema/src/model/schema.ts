import type { ModelId } from "@orcai/core";
import { z } from "zod/v4";
import { modelCapabilitiesSchema } from "../fragments/model-capabilities";
import { providerIdSchema } from "../provider";
import { createUuidIdSchema } from "../shared";
import { searchFilterSchema } from "../shared/filters";

export const modelIdSchema = createUuidIdSchema<ModelId>();

export const modelFieldsSchema = z.object({
	providerModelId: z.string(),
	name: z.string(),
	description: z.string().max(500),
	isDeprecated: z.boolean(),
	capabilities: z.array(modelCapabilitiesSchema),
});

export const modelMutableFieldsSchema = modelFieldsSchema.partial();

export const modelSchema = modelFieldsSchema.extend({
	id: modelIdSchema,
	providerId: providerIdSchema,
	createdAt: z.coerce.date().nullable(),
});

export const modelFiltersSchema = z.object({
	providerId: providerIdSchema.optional(),
	capabilities: z.array(modelCapabilitiesSchema).optional(),
	...searchFilterSchema.shape,
});

export type Model = z.infer<typeof modelSchema>;
