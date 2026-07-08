import { z } from "zod/v4";
import { paginationInputSchema, zedTokenSchema } from "../shared";
import { createUniqueRefsInputSchema } from "../shared/ref-list";
import { createSortingInputSchema } from "../shared/sorting";
import { providerIdSchema } from "./ref";
import {
	providerFieldsSchema,
	providerFiltersSchema,
	providerMutableFieldsSchema,
	providerSchema,
} from "./schema";

export const providerSortKeySchema = z.enum([
	"name",
	"enabled",
	"meteringMode",
	"createdAt",
	"updatedAt",
]);

export const listProvidersInputSchema = z.object({
	...paginationInputSchema.shape,
	...zedTokenSchema.shape,
	...createSortingInputSchema(providerSortKeySchema).shape,
	filters: providerFiltersSchema.optional(),
});

export const findProviderInputSchema = providerSchema.pick({
	id: true,
});

export const createProviderInputSchema = providerFieldsSchema;

export const updateProviderInputSchema = providerMutableFieldsSchema.extend({
	id: providerIdSchema,
});

export const deleteProviderInputSchema = z.object({
	refs: createUniqueRefsInputSchema({
		key: "id",
		value: providerIdSchema,
		entityName: "provider",
	}),
});

export type ListProvidersInput = z.infer<typeof listProvidersInputSchema>;
export type ProviderSortKey = z.infer<typeof providerSortKeySchema>;
export type FindProviderInput = z.infer<typeof findProviderInputSchema>;
export type CreateProviderInput = z.infer<typeof createProviderInputSchema>;
export type UpdateProviderInput = z.infer<typeof updateProviderInputSchema>;
export type DeleteProviderInput = z.infer<typeof deleteProviderInputSchema>;
