import { localeSchema, organizationRoleSchema } from "@orcai/schema";
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
	// Rows queued before emails were localised carry no locale.
	locale: localeSchema.default("en"),
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

/** Tells the user about a change to how they sign in. */
const securityNoticeSchema = base.extend({
	securityUrl: emailActionUrlSchema,
});

const twoFactorDisabledSchema = securityNoticeSchema.extend({
	type: z.literal("auth.two-factor-disabled"),
});

const twoFactorResetSchema = securityNoticeSchema.extend({
	type: z.literal("auth.two-factor-reset"),
});

const dataExportReadySchema = base.extend({
	type: z.literal("data-export.ready"),
	accountUrl: emailActionUrlSchema,
	expiresAt: z.coerce.date(),
});

export const emailNotificationSchema = z.discriminatedUnion("type", [
	organizationInvitedSchema,
	verifyEmailSchema,
	resetPasswordSchema,
	twoFactorDisabledSchema,
	twoFactorResetSchema,
	dataExportReadySchema,
]);

export type OrganizationInvitedNotification = z.infer<
	typeof organizationInvitedSchema
>;

export type VerifyEmailNotification = z.infer<typeof verifyEmailSchema>;

export type ResetPasswordNotification = z.infer<typeof resetPasswordSchema>;

export type TwoFactorDisabledNotification = z.infer<
	typeof twoFactorDisabledSchema
>;

export type TwoFactorResetNotification = z.infer<typeof twoFactorResetSchema>;

export type DataExportReadyNotification = z.infer<typeof dataExportReadySchema>;

export type EmailNotification = z.infer<typeof emailNotificationSchema>;
export type EmailNotificationType = EmailNotification["type"];
