import { z } from "zod/v4";
import { organizationRoleSchema } from "../fragments/organization-role";
import { preferencesSchema } from "../fragments/user-preferences";
import {
	createResourceScopedSchema,
	RESOURCE_GRANT_SOURCE,
	type ResourceType,
	resourceGrantRoleSchema,
	resourceGrantSourceSchema,
} from "../resource";
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
