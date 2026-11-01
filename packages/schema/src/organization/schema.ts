import { webSearchModes } from "@orcai/core";
import { z } from "zod/v4";
import { catalogueKindSchema } from "../catalogue/inputs";
import { modelIdSchema } from "../model/ref";
import { providerIdSchema } from "../provider/ref";
import { searchFilterSchema } from "../shared/filters";
import { organizationDescriptionSchema } from "./description";
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
	description: organizationDescriptionSchema.nullable(),
	assistantModelId: modelIdSchema.nullable(),
	utilityModelId: modelIdSchema.nullable(),
	defaultChatModelId: modelIdSchema.nullable(),
	webSearchMode: z.enum(webSearchModes),
	/** The search provider of the `provider` mode. */
	webSearchProviderId: providerIdSchema.nullable(),
	createdAt: z.coerce.date(),
});

export type Organization = z.infer<typeof organizationSchema>;

/**
 * What any signed-in user sees of an organisation on its page, with how many
 * entries of each kind it lists in the catalogue.
 */
export const organizationProfileSchema = organizationSchema
	.pick({
		id: true,
		name: true,
		logo: true,
		description: true,
	})
	.extend({
		listed: z.record(catalogueKindSchema, z.number().int()),
	});

export type OrganizationProfile = z.infer<typeof organizationProfileSchema>;

/** Narrows the organisations the caller sees by name. */
export const organizationFiltersSchema = searchFilterSchema;

/** An organisation plus how many members it has. */
export const organizationWithMemberCountSchema = organizationSchema.extend({
	memberCount: z.number().int(),
});

export type OrganizationWithMemberCount = z.infer<
	typeof organizationWithMemberCountSchema
>;

/**
 * What deleting an organisation takes with it; `homeResources` are the bots,
 * behaviours, repositories and assets it is home to, `listedResources`
 * those of them in the catalogue, with the organisations that added them.
 */
export const organizationDeletionImpactSchema = z.object({
	id: organizationIdSchema,
	name: z.string(),
	slug: z.string(),
	members: z.number().int(),
	pendingInvitations: z.number().int(),
	groups: z.number().int(),
	homeResources: z.number().int(),
	listedResources: z.array(
		z.object({
			resourceType: z.enum([
				"bot",
				"block",
			]),
			resourceId: z.string(),
			name: z.string(),
			installingOrganizations: z.array(z.string()),
		}),
	),
});

export type OrganizationDeletionImpact = z.infer<
	typeof organizationDeletionImpactSchema
>;
