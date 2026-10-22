import { Text } from "@react-email/components";
import { m } from "../paraglide/messages";
import type { DataExportReadyNotification } from "../schema";
import type { RenderableEmail } from "../types";
import { EmailLayout, paragraphStyle, REGIONAL_LOCALES } from "./layout";

export const buildDataExportReadyEmail = (
	notification: DataExportReadyNotification,
): RenderableEmail => {
	const options = {
		locale: notification.locale,
	};
	return {
		subject: m.email_data_export_ready_subject({}, options),
		element: (
			<EmailLayout
				locale={notification.locale}
				recipientName={notification.recipientName}
				preview={m.email_data_export_ready_preview({}, options)}
				title={m.email_data_export_ready_title({}, options)}
				actionLabel={m.email_data_export_ready_action({}, options)}
				actionUrl={notification.accountUrl}
			>
				<Text style={paragraphStyle}>
					{m.email_data_export_ready_body(
						{
							date: new Intl.DateTimeFormat(
								REGIONAL_LOCALES[notification.locale],
								{
									year: "numeric",
									month: "long",
									day: "numeric",
									hour: "2-digit",
									minute: "2-digit",
									timeZone: "UTC",
									timeZoneName: "short",
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
