import { render } from "@react-email/render";
import { type EmailNotification, emailNotificationSchema } from "./schema";
import { buildEmail } from "./templates";
import type { RenderedEmail } from "./types";

export const renderEmail = async (
	input: EmailNotification,
): Promise<RenderedEmail> => {
	const notification = emailNotificationSchema.parse(input);
	const email = buildEmail(notification);
	const [html, text] = await Promise.all([
		render(email.element),
		render(email.element, {
			plainText: true,
		}),
	]);
	return {
		subject: email.subject,
		html,
		text,
	};
};
