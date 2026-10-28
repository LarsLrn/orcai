import { z } from "zod/v4";
import { checkSchema } from "../shared/check";

/** What an organisation needs before its members can chat, in setup order. */
export const ORGANIZATION_CHECK_IDS = [
	"provider",
	"chat-model",
	"pool",
	"assistant-model",
	"assistant-pool",
	"utility-model",
	"members",
	"coverage",
] as const;

export const organizationCheckIdSchema = z.enum(ORGANIZATION_CHECK_IDS);

export const organizationCheckSchema = checkSchema.extend({
	id: organizationCheckIdSchema,
});

export const organizationReadinessSchema = z.object({
	checks: z.array(organizationCheckSchema),
});

export type OrganizationCheckId = z.infer<typeof organizationCheckIdSchema>;
export type OrganizationCheck = z.infer<typeof organizationCheckSchema>;
export type OrganizationReadiness = z.infer<typeof organizationReadinessSchema>;
