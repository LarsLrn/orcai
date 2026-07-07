import type { EmailNotification } from "../schema";
import type { RenderableEmail } from "../types";
import { buildOrganizationInvitedEmail } from "./organization-invited";
import { buildResetPasswordEmail } from "./reset-password";
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
	}
};
