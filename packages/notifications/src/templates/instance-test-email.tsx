import { Text } from "@react-email/components";
import { m } from "../paraglide/messages";
import type { InstanceTestEmailNotification } from "../schema";
import type { RenderableEmail } from "../types";
import { EmailLayout, paragraphStyle } from "./layout";

export const buildInstanceTestEmail = (
	notification: InstanceTestEmailNotification,
): RenderableEmail => {
	const options = {
		locale: notification.locale,
	};
	return {
		subject: m.email_instance_test_subject({}, options),
		element: (
			<EmailLayout
				locale={notification.locale}
				recipientName={notification.recipientName}
				preview={m.email_instance_test_preview({}, options)}
				title={m.email_instance_test_title({}, options)}
				actionLabel={m.email_instance_test_action({}, options)}
				actionUrl={notification.healthUrl}
			>
				<Text style={paragraphStyle}>
					{m.email_instance_test_body({}, options)}
				</Text>
			</EmailLayout>
		),
	};
};
