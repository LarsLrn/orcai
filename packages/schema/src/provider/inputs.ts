import { z } from "zod/v4";
import { paginationInputSchema, zedTokenSchema } from "../shared";
import {
	providerFieldsSchema,
	providerFiltersSchema,
	providerIdSchema,
	providerMutableFieldsSchema,
	providerSchema,
} from "./schema";

export const listProvidersInputSchema = z.object({
	...paginationInputSchema.shape,
	...zedTokenSchema.shape,
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
	refs: z.array(
		z.object({
			id: providerIdSchema,
		}),
	),
});

export type ListProvidersInput = z.infer<typeof listProvidersInputSchema>;
export type FindProviderInput = z.infer<typeof findProviderInputSchema>;
export type CreateProviderInput = z.infer<typeof createProviderInputSchema>;
export type UpdateProviderInput = z.infer<typeof updateProviderInputSchema>;
export type DeleteProviderInput = z.infer<typeof deleteProviderInputSchema>;
