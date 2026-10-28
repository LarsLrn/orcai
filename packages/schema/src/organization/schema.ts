import { webSearchModes } from "@orcai/core";
import { z } from "zod/v4";
import { modelIdSchema } from "../model/ref";
import { providerIdSchema } from "../provider/ref";
import { searchFilterSchema } from "../shared/filters";
import { organizationIdSchema } from "./ref";

export const organizationFieldsSchema = z.object({
	name: z.string().min(1),
	slug: z.string().min(1),
	metadata: z.string().nullable().optional(),
});

export const organizationMutableFieldsSchema =
	organizationFieldsSchema.partial();

export const organizationSchema = organizationFieldsSchema.extend({
	id: organizationIdSchema,
	/** The app path of the organisation's logo. */
	logo: z.string().nullable(),
	assistantModelId: modelIdSchema.nullable(),
	utilityModelId: modelIdSchema.nullable(),
	webSearchMode: z.enum(webSearchModes),
	/** The search provider of the `provider` mode. */
	webSearchProviderId: providerIdSchema.nullable(),
	createdAt: z.coerce.date(),
});

export type Organization = z.infer<typeof organizationSchema>;

/** Narrows the organisations the caller sees by name. */
export const organizationFiltersSchema = searchFilterSchema;

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
