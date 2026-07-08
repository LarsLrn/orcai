import { organizationRoleSchema } from "@orcai/schema";
import { z } from "zod/v4";

const emailActionUrlSchema = z
	.string()
	.url()
	.refine(
		(value) => {
			try {
				const url = new URL(value);
				return url.protocol === "http:" || url.protocol === "https:";
			} catch {
				return false;
			}
		},
		{
			message: "URL must use http or https scheme",
		},
	);

const base = z.object({
	recipient: z.email(),
	recipientName: z.string().optional(),
});

const organizationInvitedSchema = base.extend({
	type: z.literal("organization.invited"),
	invitationId: z.uuid(),
	organizationName: z.string().min(1),
	inviterName: z.string().min(1),
	role: organizationRoleSchema,
	expiresAt: z.coerce.date(),
	registrationUrl: emailActionUrlSchema,
});

const verifyEmailSchema = base.extend({
	type: z.literal("auth.verify-email"),
	verificationUrl: emailActionUrlSchema,
});

const resetPasswordSchema = base.extend({
	type: z.literal("auth.reset-password"),
	resetUrl: emailActionUrlSchema,
});

export const emailNotificationSchema = z.discriminatedUnion("type", [
	organizationInvitedSchema,
	verifyEmailSchema,
	resetPasswordSchema,
]);

export type OrganizationInvitedNotification = z.infer<
	typeof organizationInvitedSchema
>;

export type VerifyEmailNotification = z.infer<typeof verifyEmailSchema>;

export type ResetPasswordNotification = z.infer<typeof resetPasswordSchema>;

export type EmailNotification = z.infer<typeof emailNotificationSchema>;
export type EmailNotificationType = EmailNotification["type"];
