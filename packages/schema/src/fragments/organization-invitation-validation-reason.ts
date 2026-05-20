import { z } from "zod/v4";

export const organizationInvitationValidationReasonSchema = z.enum([
	"not_found",
	"consumed",
	"expired",
]);

export type OrganizationInvitationValidationReason = z.infer<
	typeof organizationInvitationValidationReasonSchema
>;
