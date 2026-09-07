import { z } from "zod/v4";
import {
	createDataResponseSchema,
	createDeleteResponseSchema,
	createListResponseSchema,
	statusResponseSchema,
} from "../shared";
import { organizationInvitationValidationReasonSchema } from "./parts/validation-reason";
import {
	organizationInvitationListItemSchema,
	organizationInvitationSchema,
} from "./schema";

export const listOrganizationInvitationsResponseSchema =
	createListResponseSchema(organizationInvitationListItemSchema);

export const createOrganizationInvitationsResponseSchema =
	createDataResponseSchema(z.array(organizationInvitationSchema));

export const findOrganizationInvitationResponseSchema =
	createDataResponseSchema(organizationInvitationSchema);

export const validateOrganizationInvitationResponseSchema =
	createDataResponseSchema(
		z.object({
			isValid: z.boolean(),
			reason: organizationInvitationValidationReasonSchema.nullable(),
			email: z.email().nullable(),
			/** The inviting organisation, so the register page can name it. */
			organizationName: z.string().nullable(),
			organizationSlug: z.string().nullable(),
		}),
	);

export const updateOrganizationInvitationResponseSchema =
	createDataResponseSchema(organizationInvitationSchema);

export const deleteOrganizationInvitationsResponseSchema =
	createDeleteResponseSchema();

export const respondToOrganizationInvitationResponseSchema =
	statusResponseSchema;
