import type {
	OrganizationInvitation,
	OrganizationInvitationListItem,
} from "@orcai/schema";
import { CalendarIcon, Clock4Icon } from "lucide-react";
import { OrganizationLogo } from "@/components/organizations/organization-logo";
import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { formatDisplayDate } from "@/lib/presentation/format-timestamp";
import { m } from "@/paraglide/messages";
import { OrganizationInvitationActions } from "./organization-invitation-actions";

type OrganizationInvitationEntryProps = {
	invitation: OrganizationInvitationListItem;
	onAccepted?: () => void | Promise<void>;
};

const toDisplayStatus = (
	status: OrganizationInvitation["status"],
	isExpired: boolean,
) => {
	if (isExpired) {
		return m.orgs_invitation_status_expired();
	}

	switch (status) {
		case "accepted":
			return m.orgs_invitation_status_accepted();
		case "rejected":
			return m.orgs_invitation_status_rejected();
		default:
			return m.orgs_invitation_status_pending();
	}
};

const toBadgeVariant = (
	status: OrganizationInvitation["status"],
	isExpired: boolean,
): "outline" | "default" | "destructive" => {
	if (isExpired) {
		return "destructive";
	}

	switch (status) {
		case "accepted":
			return "default";
		case "rejected":
			return "destructive";
		default:
			return "outline";
	}
};

export function OrganizationInvitationEntry({
	invitation,
	onAccepted,
}: OrganizationInvitationEntryProps) {
	const isPending = invitation.status === "pending";
	const isExpired = isPending && invitation.expiresAt < new Date();

	return (
		<Card className="w-full">
			<CardHeader className="pb-2">
				<div className="flex items-center justify-between gap-2">
					<div className="flex items-center gap-2">
						<OrganizationLogo
							organization={{
								name: invitation.organizationName,
								logo: invitation.organizationLogo,
							}}
							size="sm"
						/>
						<CardTitle className="text-lg">
							{invitation.organizationName}
						</CardTitle>
					</div>
					<Badge variant={toBadgeVariant(invitation.status, isExpired)}>
						{toDisplayStatus(invitation.status, isExpired)}
					</Badge>
				</div>
				<CardDescription className="text-xs">
					{`@${invitation.organizationSlug}`}
				</CardDescription>
			</CardHeader>
			<CardContent className="py-2">
				<div className="flex flex-col text-muted-foreground text-sm">
					<div className="flex items-center gap-2">
						<CalendarIcon className="h-3.5 w-3.5" />
						<span>
							{invitation.createdAt
								? m.orgs_invitation_invited_on({
										date: formatDisplayDate(invitation.createdAt),
									})
								: m.orgs_invitation_invited_on_unknown()}
						</span>
					</div>
					{isPending && (
						<div className="mt-1 flex items-center gap-2">
							<Clock4Icon className="h-3.5 w-3.5" />
							<span>
								{m.orgs_invitation_expires_on({
									date: formatDisplayDate(invitation.expiresAt),
								})}
							</span>
						</div>
					)}
				</div>
			</CardContent>
			{isPending && !isExpired && (
				<CardFooter>
					<CardAction>
						<OrganizationInvitationActions
							invitation={invitation}
							onAccepted={onAccepted}
						/>
					</CardAction>
				</CardFooter>
			)}
		</Card>
	);
}
