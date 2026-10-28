import { z } from "zod/v4";
import { organizationRoleSchema } from "../organization/parts/role";
import { organizationIdSchema } from "../organization/ref";
import { userIdSchema } from "../user/ref";
import { organizationInvitationStatusSchema } from "./parts/status";
import { organizationInvitationIdSchema } from "./ref";

/** How long a new invitation stays valid unless the inviter picks another date. */
export const DEFAULT_INVITATION_TTL_DAYS = 7;

export const organizationInvitationFieldsSchema = z.object({
	organizationId: organizationIdSchema,
	email: z.email(),
	role: organizationRoleSchema,
	status: organizationInvitationStatusSchema,
	expiresAt: z.coerce.date(),
	inviterId: userIdSchema,
});

export const organizationInvitationSchema =
	organizationInvitationFieldsSchema.extend({
		id: organizationInvitationIdSchema,
		createdAt: z.coerce.date().nullable(),
		updatedAt: z.coerce.date().nullable(),
	});

export type OrganizationInvitation = z.infer<
	typeof organizationInvitationSchema
>;

export const organizationInvitationFiltersSchema = z.object({
	status: organizationInvitationStatusSchema.optional(),
});

/** An invitation plus the name, slug and logo of an organisation the invitee cannot read yet. */
export const organizationInvitationListItemSchema =
	organizationInvitationSchema.extend({
		organizationName: z.string(),
		organizationSlug: z.string(),
		organizationLogo: z.string().nullable(),
	});

export type OrganizationInvitationListItem = z.infer<
	typeof organizationInvitationListItemSchema
>;
