import { z } from "zod/v4";
import { organizationRoleSchema } from "../organization/parts/role";
import { organizationIdSchema } from "../organization/ref";
import {
	createResourceScopedSchema,
	RESOURCE_GRANT_SOURCE,
	type ResourceType,
	resourceGrantRoleSchema,
	resourceGrantSourceSchema,
} from "../resource/schema";
import { searchFilterSchema } from "../shared/filters";
import { preferencesSchema } from "./parts/preferences";
import { userIdSchema } from "./ref";

export const userFieldsSchema = z.object({
	name: z.string().min(1, "Name is required"),
	email: z.string(),
	emailVerified: z.boolean(),
	image: z.string().nullable(),
	role: z.string().nullable(),
	banned: z.boolean().nullable(),
	banReason: z.string().nullable(),
	banExpires: z.coerce.date().nullable(),
	preferences: preferencesSchema.optional(),
});

export const userMutableFieldsSchema = userFieldsSchema
	.pick({
		name: true,
		image: true,
		preferences: true,
	})
	.partial();

export const userSchema = userFieldsSchema.extend({
	id: userIdSchema,
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
});

export const userWithOrganizationRoleSchema = userSchema.extend({
	organizationRole: organizationRoleSchema,
});

/** Search over name and email, for the user lists. */
export const userFiltersSchema = z.object({
	...searchFilterSchema.shape,
});

/** One organisation an account belongs to, named for the instance list. */
export const userOrganizationMembershipSchema = z.object({
	organizationId: organizationIdSchema,
	organizationName: z.string(),
	organizationSlug: z.string(),
	role: organizationRoleSchema,
});

/** An account as the instance sees it, with every membership instead of one organisation role. */
export const userWithMembershipsSchema = userSchema.extend({
	memberships: z.array(userOrganizationMembershipSchema),
});

export const USER_ACCESS_SOURCE = {
	...RESOURCE_GRANT_SOURCE,
	INHERITED_ORGANIZATION: "inherited:organization",
} as const;

export const inheritedSourceByResourceType: Record<
	ResourceType,
	| typeof USER_ACCESS_SOURCE.INHERITED_ORGANIZATION
	| z.infer<typeof resourceGrantSourceSchema>
> = {
	bot: USER_ACCESS_SOURCE.INHERITED_ORGANIZATION,
	block: USER_ACCESS_SOURCE.INHERITED_BOT,
	asset: USER_ACCESS_SOURCE.INHERITED_BLOCK,
};

const userAccessSourceSchema = z.union([
	resourceGrantSourceSchema,
	z.literal(USER_ACCESS_SOURCE.INHERITED_ORGANIZATION),
]);

export const userAccessEntrySchema = createResourceScopedSchema({
	role: resourceGrantRoleSchema,
	source: userAccessSourceSchema,
	resourceName: z.string().nullable(),
	createdAt: z.coerce.date(),
});

export type User = z.infer<typeof userSchema>;
export type UserWithOrganizationRole = z.infer<
	typeof userWithOrganizationRoleSchema
>;
export type UserAccessEntry = z.infer<typeof userAccessEntrySchema>;
export type UserOrganizationMembership = z.infer<
	typeof userOrganizationMembershipSchema
>;
export type UserWithMemberships = z.infer<typeof userWithMembershipsSchema>;
