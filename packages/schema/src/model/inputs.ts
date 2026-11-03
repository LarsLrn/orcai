import { z } from "zod/v4";
import { modelIdSchema, providerIdSchema } from "../shared/ids";
import { paginationInputSchema } from "../shared/pagination";
import { createUniqueRefsInputSchema } from "../shared/ref-list";
import { createSortingInputSchema } from "../shared/sorting";
import {
	modelCapabilitiesSchema,
	modelFieldsSchema,
	modelFiltersSchema,
	modelMutableFieldsSchema,
} from "./schema";

const modelSortKeySchema = z.enum([
	"name",
	"providerName",
	"isDeprecated",
	"createdAt",
]);

export const listModelsInputSchema = paginationInputSchema.extend({
	filters: modelFiltersSchema.optional(),
	...createSortingInputSchema(modelSortKeySchema).shape,
});

export const findModelInputSchema = z.object({
	id: modelIdSchema,
});

/** An admin's choice; choosing none leaves the capabilities not set. */
const chosenCapabilitiesSchema = z
	.array(modelCapabilitiesSchema)
	.transform((capabilities) => (capabilities.length > 0 ? capabilities : null));

export const createModelInputSchema = modelFieldsSchema.extend({
	providerId: providerIdSchema,
	capabilities: chosenCapabilitiesSchema,
});

export const updateModelInputSchema = modelMutableFieldsSchema.extend({
	id: modelIdSchema,
	providerId: providerIdSchema.optional(),
	capabilities: chosenCapabilitiesSchema.optional(),
});

export const deleteModelsInputSchema = z.object({
	refs: createUniqueRefsInputSchema({
		key: "id",
		value: modelIdSchema,
	}),
});

export const discoverModelsInputSchema = z.object({
	providerId: providerIdSchema,
});

export type ModelSortKey = z.infer<typeof modelSortKeySchema>;
export type CreateModelInput = z.infer<typeof createModelInputSchema>;
export type UpdateModelInput = z.infer<typeof updateModelInputSchema>;
