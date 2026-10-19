import type { Locale, OrganizationRole } from "@orcai/schema";
import { Text } from "@react-email/components";
import { m } from "../paraglide/messages";
import type { OrganizationInvitedNotification } from "../schema";
import type { RenderableEmail } from "../types";
import { EmailLayout, paragraphStyle } from "./layout";

const roleLabels: Record<
	OrganizationRole,
	(
		inputs: object,
		options: {
			locale: Locale;
		},
	) => string
> = {
	admin: m.email_organization_invited_role_admin,
	manager: m.email_organization_invited_role_manager,
	member: m.email_organization_invited_role_member,
	viewer: m.email_organization_invited_role_viewer,
};

const REGIONAL_LOCALES: Record<Locale, string> = {
	en: "en-GB",
	de: "de-DE",
};

export const buildOrganizationInvitedEmail = (
	notification: OrganizationInvitedNotification,
): RenderableEmail => {
	const options = {
		locale: notification.locale,
	};
	const organization = notification.organizationName;
	return {
		subject: m.email_organization_invited_subject(
			{
				organization,
			},
			options,
		),
		element: (
			<EmailLayout
				locale={notification.locale}
				recipientName={notification.recipientName}
				preview={m.email_organization_invited_preview(
					{
						organization,
					},
					options,
				)}
				title={m.email_organization_invited_title({}, options)}
				actionLabel={m.email_organization_invited_action({}, options)}
				actionUrl={notification.registrationUrl}
			>
				<Text style={paragraphStyle}>
					{m.email_organization_invited_body(
						{
							inviter: notification.inviterName,
							organization,
							role: roleLabels[notification.role]({}, options),
							date: new Intl.DateTimeFormat(
								REGIONAL_LOCALES[notification.locale],
								{
									dateStyle: "long",
									timeZone: "UTC",
								},
							).format(notification.expiresAt),
						},
						options,
					)}
				</Text>
			</EmailLayout>
		),
	};
};
