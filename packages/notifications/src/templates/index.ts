import type { EmailNotification } from "../schema";
import type { RenderableEmail } from "../types";
import { buildDataExportReadyEmail } from "./data-export-ready";
import { buildInstanceTestEmail } from "./instance-test-email";
import { buildOrganizationInvitedEmail } from "./organization-invited";
import { buildResetPasswordEmail } from "./reset-password";
import {
	buildInstanceAdminGrantedEmail,
	buildInstanceAdminRevokedEmail,
	buildPasskeyAddedEmail,
	buildTwoFactorDisabledEmail,
	buildTwoFactorResetEmail,
} from "./security-notice";
import { buildVerifyEmail } from "./verify-email";

export type { RenderableEmail } from "../types";

export const buildEmail = (
	notification: EmailNotification,
): RenderableEmail => {
	switch (notification.type) {
		case "organization.invited":
			return buildOrganizationInvitedEmail(notification);
		case "auth.verify-email":
			return buildVerifyEmail(notification);
		case "auth.reset-password":
			return buildResetPasswordEmail(notification);
		case "auth.two-factor-disabled":
			return buildTwoFactorDisabledEmail(notification);
		case "auth.two-factor-reset":
			return buildTwoFactorResetEmail(notification);
		case "auth.instance-admin-granted":
			return buildInstanceAdminGrantedEmail(notification);
		case "auth.instance-admin-revoked":
			return buildInstanceAdminRevokedEmail(notification);
		case "auth.passkey-added":
			return buildPasskeyAddedEmail(notification);
		case "data-export.ready":
			return buildDataExportReadyEmail(notification);
		case "instance.test-email":
			return buildInstanceTestEmail(notification);
	}
};
