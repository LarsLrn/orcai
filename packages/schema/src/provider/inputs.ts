import { z } from "zod/v4";
import { providerIdSchema } from "../shared/ids";
import { paginationInputSchema } from "../shared/pagination";
import { createUniqueRefsInputSchema } from "../shared/ref-list";
import { createSortingInputSchema } from "../shared/sorting";
import { zedTokenSchema } from "../shared/zed-token";
import {
	checkProviderFields,
	providerFieldsSchema,
	providerFiltersSchema,
	providerMutableFieldsSchema,
	providerSchema,
} from "./schema";

const providerSortKeySchema = z.enum([
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

export const createProviderInputSchema =
	providerFieldsSchema.check(checkProviderFields);

export const updateProviderInputSchema = providerMutableFieldsSchema.extend({
	id: providerIdSchema,
});

export const deleteProviderInputSchema = z.object({
	refs: createUniqueRefsInputSchema({
		key: "id",
		value: providerIdSchema,
	}),
});

export type ProviderSortKey = z.infer<typeof providerSortKeySchema>;
