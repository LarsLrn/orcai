import { z } from "zod/v4";

export const organizationInvitationStatusSchema = z.enum([
	"pending",
	"accepted",
	"rejected",
]);

export type OrganizationInvitationStatus = z.infer<
	typeof organizationInvitationStatusSchema
>;
