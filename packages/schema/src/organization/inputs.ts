import { z } from "zod/v4";
import { paginationInputSchema } from "../shared";
import { createUniqueRefsInputSchema } from "../shared/ref-list";
import { createSortingInputSchema } from "../shared/sorting";
import { organizationIdSchema } from "./ref";
import {
	organizationFieldsSchema,
	organizationFiltersSchema,
	organizationMutableFieldsSchema,
	organizationSchema,
} from "./schema";

export const organizationSortKeySchema = z.enum([
	"name",
	"slug",
	"createdAt",
]);

export const listOrganizationsInputSchema = paginationInputSchema.extend({
	filters: organizationFiltersSchema.optional(),
	...createSortingInputSchema(organizationSortKeySchema).shape,
});

export const instanceOrganizationSortKeySchema = z.enum([
	"name",
	"slug",
	"createdAt",
	"memberCount",
]);

export const listAllOrganizationsInputSchema = paginationInputSchema.extend({
	...createSortingInputSchema(instanceOrganizationSortKeySchema).shape,
});

export const findOrganizationInputSchema = organizationSchema.pick({
	id: true,
});

export const organizationDeletionImpactInputSchema = organizationSchema.pick({
	id: true,
});

export const createOrganizationInputSchema = organizationFieldsSchema;

export const updateOrganizationInputSchema =
	organizationMutableFieldsSchema.extend({
		id: organizationIdSchema,
	});

export const deleteOrganizationsInputSchema = z.object({
	refs: createUniqueRefsInputSchema({
		key: "id",
		value: organizationIdSchema,
		entityName: "organisation",
	}),
});

export type ListOrganizationsInput = z.infer<
	typeof listOrganizationsInputSchema
>;
export type OrganizationSortKey = z.infer<typeof organizationSortKeySchema>;
export type ListAllOrganizationsInput = z.infer<
	typeof listAllOrganizationsInputSchema
>;
export type InstanceOrganizationSortKey = z.infer<
	typeof instanceOrganizationSortKeySchema
>;
export type FindOrganizationInput = z.infer<typeof findOrganizationInputSchema>;
export type OrganizationDeletionImpactInput = z.infer<
	typeof organizationDeletionImpactInputSchema
>;
export type CreateOrganizationInput = z.infer<
	typeof createOrganizationInputSchema
>;
export type UpdateOrganizationInput = z.infer<
	typeof updateOrganizationInputSchema
>;
export type DeleteOrganizationsInput = z.infer<
	typeof deleteOrganizationsInputSchema
>;
