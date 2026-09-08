import { z } from "zod/v4";
import { searchFilterSchema } from "../shared/filters";
import { organizationRoleSchema } from "./parts/role";
import { organizationIdSchema } from "./ref";

export const organizationFieldsSchema = z.object({
	name: z.string().min(1, "Name is required"),
	slug: z.string().min(1, "Slug is required"),
	logo: z.string().nullable().optional(),
	metadata: z.string().nullable().optional(),
});

export const organizationMutableFieldsSchema =
	organizationFieldsSchema.partial();

export const organizationSchema = organizationFieldsSchema.extend({
	id: organizationIdSchema,
	createdAt: z.coerce.date(),
});

export type Organization = z.infer<typeof organizationSchema>;

/** Narrows the organisations the caller sees, by its membership role or by name. */
export const organizationFiltersSchema = z.object({
	role: organizationRoleSchema.optional(),
	...searchFilterSchema.shape,
});

/** An organisation plus how many members it has, for the instance list. */
export const organizationWithMemberCountSchema = organizationSchema.extend({
	memberCount: z.number().int(),
});

export type OrganizationWithMemberCount = z.infer<
	typeof organizationWithMemberCountSchema
>;

/** What deleting an organisation takes with it; `exclusiveResources` are scoped to it alone. */
export const organizationDeletionImpactSchema = z.object({
	id: organizationIdSchema,
	name: z.string(),
	slug: z.string(),
	members: z.number().int(),
	pendingInvitations: z.number().int(),
	groups: z.number().int(),
	exclusiveResources: z.number().int(),
});

export type OrganizationDeletionImpact = z.infer<
	typeof organizationDeletionImpactSchema
>;
