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

/** Narrows the invitations the caller sees; `recipient: "me"` keeps only those it received. */
export const organizationInvitationFiltersSchema = z.object({
	status: organizationInvitationStatusSchema.optional(),
	recipient: z.literal("me").optional(),
});

/** An invitation plus the name and slug of an organisation the invitee cannot read yet. */
export const organizationInvitationListItemSchema =
	organizationInvitationSchema.extend({
		organizationName: z.string(),
		organizationSlug: z.string(),
	});

export type OrganizationInvitationListItem = z.infer<
	typeof organizationInvitationListItemSchema
>;
