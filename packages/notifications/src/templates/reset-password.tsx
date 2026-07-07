import { Text } from "@react-email/components";
import type { ResetPasswordNotification } from "../schema";
import type { RenderableEmail } from "../types";
import { EmailLayout, paragraphStyle } from "./layout";

export const buildResetPasswordEmail = (
	notification: ResetPasswordNotification,
): RenderableEmail => ({
	subject: "Reset your OrcAI password",
	element: (
		<EmailLayout
			preview="Reset your OrcAI password"
			title="Reset your password"
			actionLabel="Reset password"
			actionUrl={notification.resetUrl}
		>
			<Text style={paragraphStyle}>
				Hello {notification.recipientName ?? ""},
			</Text>
			<Text style={paragraphStyle}>
				Use this link to choose a new password. If you did not request this, you
				can ignore this message.
			</Text>
		</EmailLayout>
	),
});
