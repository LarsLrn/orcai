import { z } from "zod/v4";
import { organizationRoleSchema } from "../organization/parts/role";
import { searchFilterSchema } from "../shared/filters";
import { preferencesSchema } from "./parts/preferences";
import { userIdSchema } from "./ref";

export const userFieldsSchema = z.object({
	name: z.string().min(1),
	email: z.string(),
	emailVerified: z.boolean(),
	/** The app path of the profile picture. */
	image: z.string().nullable(),
	role: z.string().nullable(),
	banned: z.boolean().nullable(),
	banReason: z.string().nullable(),
	banExpires: z.coerce.date().nullable(),
	preferences: preferencesSchema.optional(),
});

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

export type User = z.infer<typeof userSchema>;
export type UserWithOrganizationRole = z.infer<
	typeof userWithOrganizationRoleSchema
>;
