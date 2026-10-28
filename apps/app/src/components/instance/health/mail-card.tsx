import type { EmailDeliveryChannel, InstanceMail } from "@orcai/schema";
import { MailIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableRow,
} from "@/components/ui/table";
import { useSendTestEmailMutation } from "@/hooks/mutations/use-send-test-email-mutation";
import { formatCount } from "@/lib/presentation/format-number";
import { formatDisplayTimestamp } from "@/lib/presentation/format-timestamp";
import { m } from "@/paraglide/messages";

const channelLabel = (channel: EmailDeliveryChannel | null) => {
	switch (channel) {
		case "smtp":
			return m.instance_health_mail_channel_smtp();
		case "log":
			return m.instance_health_mail_channel_log();
		case null:
			return m.instance_health_none();
	}
};

const testEmailStatus = (
	status: NonNullable<InstanceMail["testEmail"]>["status"],
) => {
	switch (status) {
		case "pending":
		case "processing":
			return (
				<Badge variant="processing">
					{m.instance_health_test_email_status_pending()}
				</Badge>
			);
		case "sent":
			return (
				<Badge variant="success">
					{m.instance_health_test_email_status_sent()}
				</Badge>
			);
		case "dead":
			return (
				<Badge variant="danger">
					{m.instance_health_test_email_status_dead()}
				</Badge>
			);
	}
};

/** Outbox state and the viewer's own test email. */
export const MailCard = ({ mail }: { mail: InstanceMail | null }) => {
	const { mutate: sendTestEmail, isPending } = useSendTestEmailMutation();
	const testEmail = mail?.testEmail;
	const rows = mail
		? [
				{
					key: "pending",
					label: m.instance_health_mail_pending_label(),
					value: formatCount(mail.pending),
				},
				{
					key: "dead",
					label: m.instance_health_mail_dead_label(),
					value: formatCount(mail.dead),
				},
				{
					key: "last-error",
					label: m.instance_health_mail_last_error_label(),
					value: mail.lastError ? (
						<span className="font-mono text-xs">{mail.lastError}</span>
					) : (
						m.instance_health_none()
					),
				},
				{
					key: "channel",
					label: m.instance_health_mail_last_channel_label(),
					value: channelLabel(mail.lastDeliveryChannel),
				},
				{
					key: "test-email",
					label: m.instance_health_test_email_label(),
					value: testEmail ? (
						<span className="flex flex-wrap items-center gap-2">
							{testEmailStatus(testEmail.status)}
							{testEmail.deliveryChannel && (
								<span>{channelLabel(testEmail.deliveryChannel)}</span>
							)}
							<span className="text-muted-foreground text-xs">
								{formatDisplayTimestamp(
									testEmail.sentAt ?? testEmail.createdAt,
								)}
							</span>
						</span>
					) : (
						m.instance_health_none()
					),
				},
			]
		: [];

	return (
		<Card>
			<CardHeader>
				<CardTitle>{m.instance_health_mail_title()}</CardTitle>
				<CardDescription>
					{m.instance_health_mail_description()}
				</CardDescription>
				<CardAction>
					<Button
						variant="outline"
						disabled={isPending}
						onClick={() => sendTestEmail({})}
					>
						<MailIcon />
						{m.instance_health_test_email_button()}
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent>
				{mail ? (
					<div className="overflow-auto rounded-md border">
						<Table>
							<TableBody>
								{rows.map((row) => (
									<TableRow key={row.key}>
										<TableHead scope="row" className="w-1/3">
											{row.label}
										</TableHead>
										<TableCell className="whitespace-normal break-all">
											{row.value}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
				) : (
					<p className="py-6 text-center text-muted-foreground text-sm">
						{m.instance_health_mail_unavailable()}
					</p>
				)}
			</CardContent>
		</Card>
	);
};
