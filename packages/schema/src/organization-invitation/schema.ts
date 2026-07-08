import { z } from "zod/v4";
import { organizationRoleSchema } from "../organization/parts/role";
import { organizationIdSchema } from "../organization/ref";
import { userIdSchema } from "../user/ref";
import { organizationInvitationStatusSchema } from "./parts/status";
import { organizationInvitationIdSchema } from "./ref";

export const organizationInvitationFieldsSchema = z.object({
	organizationId: organizationIdSchema,
	email: z.email("Field must be a valid email"),
	role: organizationRoleSchema,
	status: organizationInvitationStatusSchema,
	expiresAt: z.coerce.date(),
	inviterId: userIdSchema,
});

export const organizationInvitationMutableFieldsSchema =
	organizationInvitationFieldsSchema
		.pick({
			status: true,
			expiresAt: true,
		})
		.partial();

export const organizationInvitationSchema =
	organizationInvitationFieldsSchema.extend({
		id: organizationInvitationIdSchema,
		createdAt: z.coerce.date().nullable(),
		updatedAt: z.coerce.date().nullable(),
	});

export type OrganizationInvitation = z.infer<
	typeof organizationInvitationSchema
>;
