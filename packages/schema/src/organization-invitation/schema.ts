import type { OrganizationInvitationId } from "@orcai/core";
import { z } from "zod/v4";
import {
	organizationInvitationStatusSchema,
	organizationRoleSchema,
} from "../fragments";
import { organizationIdSchema } from "../organization";
import { createUuidIdSchema } from "../shared";
import { userIdSchema } from "../user";

export const organizationInvitationIdSchema =
	createUuidIdSchema<OrganizationInvitationId>();

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
