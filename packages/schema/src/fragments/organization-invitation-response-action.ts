import { z } from "zod/v4";

export const organizationInvitationResponseActionSchema = z.enum([
	"accept",
	"reject",
]);

export type OrganizationInvitationResponseAction = z.infer<
	typeof organizationInvitationResponseActionSchema
>;
