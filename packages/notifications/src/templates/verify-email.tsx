import { Text } from "@react-email/components";
import type { VerifyEmailNotification } from "../schema";
import type { RenderableEmail } from "../types";
import { EmailLayout, paragraphStyle } from "./layout";

export const buildVerifyEmail = (
	notification: VerifyEmailNotification,
): RenderableEmail => ({
	subject: "Verify your email address",
	element: (
		<EmailLayout
			preview="Verify your OrcAI email address"
			title="Verify your email"
			actionLabel="Verify email"
			actionUrl={notification.verificationUrl}
		>
			<Text style={paragraphStyle}>
				Hello {notification.recipientName ?? ""},
			</Text>
			<Text style={paragraphStyle}>
				Confirm that this email address belongs to you to finish setting up your
				OrcAI account.
			</Text>
		</EmailLayout>
	),
});
