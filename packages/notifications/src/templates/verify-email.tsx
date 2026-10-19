import { Text } from "@react-email/components";
import { m } from "../paraglide/messages";
import type { VerifyEmailNotification } from "../schema";
import type { RenderableEmail } from "../types";
import { EmailLayout, paragraphStyle } from "./layout";

export const buildVerifyEmail = (
	notification: VerifyEmailNotification,
): RenderableEmail => {
	const options = {
		locale: notification.locale,
	};
	return {
		subject: m.email_verify_subject({}, options),
		element: (
			<EmailLayout
				locale={notification.locale}
				recipientName={notification.recipientName}
				preview={m.email_verify_preview({}, options)}
				title={m.email_verify_title({}, options)}
				actionLabel={m.email_verify_action({}, options)}
				actionUrl={notification.verificationUrl}
			>
				<Text style={paragraphStyle}>{m.email_verify_body({}, options)}</Text>
			</EmailLayout>
		),
	};
};
