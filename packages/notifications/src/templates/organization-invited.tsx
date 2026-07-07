import { Text } from "@react-email/components";
import type { OrganizationInvitedNotification } from "../schema";
import type { RenderableEmail } from "../types";
import { EmailLayout, paragraphStyle } from "./layout";

export const buildOrganizationInvitedEmail = (
	notification: OrganizationInvitedNotification,
): RenderableEmail => ({
	subject: `You are invited to ${notification.organizationName}`,
	element: (
		<EmailLayout
			preview={`Join ${notification.organizationName} on OrcAI`}
			title="You have been invited"
			actionLabel="Accept invitation"
			actionUrl={notification.registrationUrl}
		>
			<Text style={paragraphStyle}>
				Hello {notification.recipientName ?? ""},
			</Text>
			<Text style={paragraphStyle}>
				{notification.inviterName} invited you to join{" "}
				{notification.organizationName} as {notification.role}. This invitation
				expires on{" "}
				{notification.expiresAt.toLocaleDateString("en-GB", {
					dateStyle: "long",
					timeZone: "UTC",
				})}
				.
			</Text>
		</EmailLayout>
	),
});
