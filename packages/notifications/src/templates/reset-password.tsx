import { Text } from "@react-email/components";
import { m } from "../paraglide/messages";
import type { ResetPasswordNotification } from "../schema";
import type { RenderableEmail } from "../types";
import { EmailLayout, paragraphStyle } from "./layout";

export const buildResetPasswordEmail = (
	notification: ResetPasswordNotification,
): RenderableEmail => {
	const options = {
		locale: notification.locale,
	};
	return {
		subject: m.email_reset_password_subject({}, options),
		element: (
			<EmailLayout
				locale={notification.locale}
				recipientName={notification.recipientName}
				preview={m.email_reset_password_preview({}, options)}
				title={m.email_reset_password_title({}, options)}
				actionLabel={m.email_reset_password_action({}, options)}
				actionUrl={notification.resetUrl}
			>
				<Text style={paragraphStyle}>
					{m.email_reset_password_body({}, options)}
				</Text>
			</EmailLayout>
		),
	};
};
