import { z } from "zod/v4";
import { organizationRoleSchema } from "../fragments/organization-role";
import { memberIdSchema, organizationIdSchema } from "../organization/ref";
import { userIdSchema } from "../user/ref";

export const organizationMemberFieldsSchema = z.object({
	organizationId: organizationIdSchema,
	userId: userIdSchema,
	role: organizationRoleSchema,
});

export const organizationMemberMutableFieldsSchema =
	organizationMemberFieldsSchema
		.omit({
			organizationId: true,
			userId: true,
		})
		.partial();

export const organizationMemberSchema = organizationMemberFieldsSchema.extend({
	id: memberIdSchema,
	createdAt: z.coerce.date().nullable(),
});

export type OrganizationMember = z.infer<typeof organizationMemberSchema>;
