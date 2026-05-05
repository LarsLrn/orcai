import { dbSchema } from "@orcai/db/schema";
import { preferencesSchema, userIdSchema } from "@orcai/schema";
import {
	createInsertSchema,
	createSelectSchema,
	createUpdateSchema,
} from "drizzle-orm/zod";
import { z } from "zod/v4";
import { organizationMemberSelectSchema } from "./organization-member";
import {
	createResourceScopedSchema,
	RESOURCE_GRANT_SOURCE,
	type ResourceType,
	resourceGrantRoleSchema,
	resourceGrantSourceSchema,
} from "./resource";

/**
 * ----------------
 * Select Schema
 * ----------------
 */

export const userSelectSchema = createSelectSchema(dbSchema.user, {
	id: userIdSchema,
}).extend({
	preferences: preferencesSchema.optional(),
});

export const userWithOrganizationRoleSelectSchema = userSelectSchema.extend({
	organizationRole: organizationMemberSelectSchema.shape.role,
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

/**
 * ----------------
 * Insert Schema
 * ----------------
 */

export const userInsertSchema = createInsertSchema(dbSchema.user).extend({
	preferences: preferencesSchema.optional(),
});

/**
 * ----------------
 * Update Schema
 * ----------------
 */

export const userUpdateSchema = createUpdateSchema(dbSchema.user);

/**
 * ----------------
 * Delete Schema
 * ----------------
 */

export const userDeleteSchema = z.object({
	refs: z.array(
		userSelectSchema.pick({
			id: true,
		}),
	),
});

/**
 * ----------------
 * Type Definitions
 * ----------------
 */

export type User = z.infer<typeof userSelectSchema>;
export type UserWithOrganizationRole = z.infer<
	typeof userWithOrganizationRoleSelectSchema
>;
export type UserAccessEntry = z.infer<typeof userAccessEntrySchema>;
export type UserInsert = z.infer<typeof userInsertSchema>;
export type UserUpdate = z.infer<typeof userUpdateSchema>;
export type UserDelete = z.infer<typeof userDeleteSchema>;
