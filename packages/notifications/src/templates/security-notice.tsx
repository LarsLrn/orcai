import { Text } from "@react-email/components";
import { m } from "../paraglide/messages";
import type { TwoFactorDisabledNotification } from "../schema";
import type { RenderableEmail } from "../types";
import { EmailLayout, paragraphStyle } from "./layout";

const securityNotice = (
	notification: TwoFactorDisabledNotification,
	content: {
		subject: string;
		preview: string;
		title: string;
		body: string;
	},
): RenderableEmail => {
	const options = {
		locale: notification.locale,
	};
	return {
		subject: content.subject,
		element: (
			<EmailLayout
				locale={notification.locale}
				recipientName={notification.recipientName}
				preview={content.preview}
				title={content.title}
				actionLabel={m.email_security_action({}, options)}
				actionUrl={notification.securityUrl}
			>
				<Text style={paragraphStyle}>{content.body}</Text>
				<Text style={paragraphStyle}>
					{m.email_security_unexpected({}, options)}
				</Text>
			</EmailLayout>
		),
	};
};

export const buildTwoFactorDisabledEmail = (
	notification: TwoFactorDisabledNotification,
): RenderableEmail => {
	const options = {
		locale: notification.locale,
	};
	return securityNotice(notification, {
		subject: m.email_two_factor_disabled_subject({}, options),
		preview: m.email_two_factor_disabled_preview({}, options),
		title: m.email_two_factor_disabled_title({}, options),
		body: m.email_two_factor_disabled_body({}, options),
	});
};
