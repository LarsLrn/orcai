import { z } from "zod/v4";
import { organizationInvitationValidationReasonSchema } from "../fragments";
import {
	createDataResponseSchema,
	createDeleteResponseSchema,
	createListResponseSchema,
} from "../shared";
import { organizationInvitationSchema } from "./schema";

export const listOrganizationInvitationsResponseSchema =
	createListResponseSchema(organizationInvitationSchema);

export const createOrganizationInvitationsResponseSchema =
	createDataResponseSchema(z.array(organizationInvitationSchema));

export const findOrganizationInvitationResponseSchema =
	createDataResponseSchema(organizationInvitationSchema);

export const validateOrganizationInvitationResponseSchema =
	createDataResponseSchema(
		z.object({
			isValid: z.boolean(),
			reason: organizationInvitationValidationReasonSchema.nullable(),
		}),
	);

export const updateOrganizationInvitationResponseSchema =
	createDataResponseSchema(organizationInvitationSchema);

export const deleteOrganizationInvitationsResponseSchema =
	createDeleteResponseSchema();

export const respondToOrganizationInvitationResponseSchema =
	createDeleteResponseSchema();
