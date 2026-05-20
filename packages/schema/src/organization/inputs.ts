import { z } from "zod/v4";
import { paginationInputSchema } from "../shared";
import { organizationIdSchema } from "./ref";
import {
	organizationFieldsSchema,
	organizationMutableFieldsSchema,
	organizationSchema,
} from "./schema";

export const listOrganizationsInputSchema = paginationInputSchema;

export const findOrganizationInputSchema = organizationSchema.pick({
	id: true,
});

export const createOrganizationInputSchema = organizationFieldsSchema;

export const updateOrganizationInputSchema =
	organizationMutableFieldsSchema.extend({
		id: organizationIdSchema,
	});

export const deleteOrganizationsInputSchema = z.object({
	refs: z.array(
		z.object({
			id: organizationIdSchema,
		}),
	),
});

export type ListOrganizationsInput = z.infer<
	typeof listOrganizationsInputSchema
>;
export type FindOrganizationInput = z.infer<typeof findOrganizationInputSchema>;
export type CreateOrganizationInput = z.infer<
	typeof createOrganizationInputSchema
>;
export type UpdateOrganizationInput = z.infer<
	typeof updateOrganizationInputSchema
>;
export type DeleteOrganizationsInput = z.infer<
	typeof deleteOrganizationsInputSchema
>;
