import { z } from "zod/v4";
import { providerIdSchema } from "../provider/ref";
import { paginationInputSchema } from "../shared";
import { modelIdSchema } from "./ref";
import {
	modelFieldsSchema,
	modelFiltersSchema,
	modelMutableFieldsSchema,
} from "./schema";

export const listModelsInputSchema = paginationInputSchema.extend({
	filters: modelFiltersSchema.optional(),
});

export const findModelInputSchema = z.object({
	id: modelIdSchema,
});

export const createModelInputSchema = modelFieldsSchema.extend({
	providerId: providerIdSchema,
});

export const updateModelInputSchema = modelMutableFieldsSchema.extend({
	id: modelIdSchema,
	providerId: providerIdSchema.optional(),
});

export const deleteModelsInputSchema = z.object({
	refs: z.array(
		z.object({
			id: modelIdSchema,
		}),
	),
});

export const discoverModelsInputSchema = z.object({
	providerId: providerIdSchema,
});

export type ListModelsInput = z.infer<typeof listModelsInputSchema>;
export type FindModelInput = z.infer<typeof findModelInputSchema>;
export type CreateModelInput = z.infer<typeof createModelInputSchema>;
export type UpdateModelInput = z.infer<typeof updateModelInputSchema>;
export type DeleteModelsInput = z.infer<typeof deleteModelsInputSchema>;
export type DiscoverModelsInput = z.infer<typeof discoverModelsInputSchema>;
