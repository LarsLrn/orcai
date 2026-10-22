import { Text } from "@react-email/components";
import { m } from "../paraglide/messages";
import type {
	InstanceAdminGrantedNotification,
	InstanceAdminRevokedNotification,
	TwoFactorDisabledNotification,
	TwoFactorResetNotification,
} from "../schema";
import type { RenderableEmail } from "../types";
import { EmailLayout, paragraphStyle } from "./layout";

const securityNotice = (
	notification:
		| TwoFactorDisabledNotification
		| TwoFactorResetNotification
		| InstanceAdminGrantedNotification
		| InstanceAdminRevokedNotification,
	content: {
		subject: string;
		preview: string;
		title: string;
		paragraphs: string[];
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
				{content.paragraphs.map((paragraph) => (
					<Text key={paragraph} style={paragraphStyle}>
						{paragraph}
					</Text>
				))}
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
		paragraphs: [
			m.email_two_factor_disabled_body({}, options),
			m.email_security_unexpected({}, options),
		],
	});
};

export const buildTwoFactorResetEmail = (
	notification: TwoFactorResetNotification,
): RenderableEmail => {
	const options = {
		locale: notification.locale,
	};
	return securityNotice(notification, {
		subject: m.email_two_factor_reset_subject({}, options),
		preview: m.email_two_factor_reset_preview({}, options),
		title: m.email_two_factor_reset_title({}, options),
		paragraphs: [
			m.email_two_factor_reset_body({}, options),
			m.email_security_unexpected({}, options),
		],
	});
};

export const buildInstanceAdminGrantedEmail = (
	notification: InstanceAdminGrantedNotification,
): RenderableEmail => {
	const options = {
		locale: notification.locale,
	};
	return securityNotice(notification, {
		subject: m.email_instance_admin_granted_subject({}, options),
		preview: m.email_instance_admin_granted_preview({}, options),
		title: m.email_instance_admin_granted_title({}, options),
		paragraphs: [
			m.email_instance_admin_granted_body({}, options),
			...(notification.twoFactorRequired
				? [
						m.email_instance_admin_granted_two_factor({}, options),
					]
				: []),
			m.email_instance_role_unexpected({}, options),
		],
	});
};

export const buildInstanceAdminRevokedEmail = (
	notification: InstanceAdminRevokedNotification,
): RenderableEmail => {
	const options = {
		locale: notification.locale,
	};
	return securityNotice(notification, {
		subject: m.email_instance_admin_revoked_subject({}, options),
		preview: m.email_instance_admin_revoked_preview({}, options),
		title: m.email_instance_admin_revoked_title({}, options),
		paragraphs: [
			m.email_instance_admin_revoked_body({}, options),
			m.email_instance_role_unexpected({}, options),
		],
	});
};
