import { z } from "zod/v4";
import { modelIdSchema } from "../model/ref";
import { providerIdSchema } from "../provider/ref";
import { paginationInputSchema } from "../shared";
import { searchFilterSchema } from "../shared/filters";
import { localeSchema } from "../shared/primitives/locale";
import { createUniqueRefsInputSchema } from "../shared/ref-list";
import { createSortingInputSchema } from "../shared/sorting";
import { userIdSchema } from "../user/ref";
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
	filters: searchFilterSchema.optional(),
	...createSortingInputSchema(instanceOrganizationSortKeySchema).shape,
});

export const findOrganizationInputSchema = organizationSchema.pick({
	id: true,
});

export const organizationDeletionImpactInputSchema = organizationSchema.pick({
	id: true,
});

/**
 * Who administers a new organisation: its creator, an existing account (the
 * creator is not added), or an invitee, with the creator as admin until they leave.
 */
export const initialOrganizationAdminSchema = z.discriminatedUnion("kind", [
	z.object({
		kind: z.literal("me"),
	}),
	z.object({
		kind: z.literal("user"),
		userId: userIdSchema,
	}),
	z.object({
		kind: z.literal("invite"),
		email: z.email(),
		/** Language of the invitation email. */
		locale: localeSchema.optional(),
	}),
]);

export const createOrganizationInputSchema = organizationFieldsSchema.extend({
	initialAdmin: initialOrganizationAdminSchema.default({
		kind: "me",
	}),
});

export const updateOrganizationInputSchema =
	organizationMutableFieldsSchema.extend({
		id: organizationIdSchema,
		assistantModelId: modelIdSchema.nullable().optional(),
		utilityModelId: modelIdSchema.nullable().optional(),
		/** Off, the model's own search, or one of the organisation's search providers. */
		webSearch: z
			.discriminatedUnion("mode", [
				z.object({
					mode: z.enum([
						"off",
						"native",
					]),
				}),
				z.object({
					mode: z.literal("provider"),
					providerId: providerIdSchema,
				}),
			])
			.optional(),
	});

export const deleteOrganizationsInputSchema = z.object({
	refs: createUniqueRefsInputSchema({
		key: "id",
		value: organizationIdSchema,
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
