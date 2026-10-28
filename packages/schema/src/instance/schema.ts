import { z } from "zod/v4";
import { organizationRoleSchema } from "../organization/parts/role";
import { organizationIdSchema } from "../organization/ref";
import { userIdSchema } from "../user/ref";
import { userSchema } from "../user/schema";

/** An account as the instance sees it. */
export const instanceUserSchema = userSchema.extend({
	twoFactorEnabled: z.boolean(),
	membershipCount: z.number().int(),
});

/** One organisation an account belongs to, on the instance user page. */
export const instanceUserMembershipSchema = z.object({
	organizationId: organizationIdSchema,
	name: z.string(),
	slug: z.string(),
	role: organizationRoleSchema,
	joinedAt: z.coerce.date().nullable(),
});

/** One member of an organisation, on the instance organisation page. */
export const instanceOrganizationMemberSchema = z.object({
	userId: userIdSchema,
	name: z.string(),
	email: z.string(),
	banned: z.boolean(),
	role: organizationRoleSchema,
	joinedAt: z.coerce.date().nullable(),
});

export type InstanceUser = z.infer<typeof instanceUserSchema>;
export type InstanceUserMembership = z.infer<
	typeof instanceUserMembershipSchema
>;
export type InstanceOrganizationMember = z.infer<
	typeof instanceOrganizationMemberSchema
>;
