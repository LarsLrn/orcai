import type {
	OrganizationInvitation,
	OrganizationInvitationListItem,
} from "@orcai/schema";
import { Building2Icon, CalendarIcon, Clock4Icon } from "lucide-react";
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
		return "Expired";
	}

	return status.charAt(0).toUpperCase() + status.slice(1);
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
						<Building2Icon className="h-4 w-4 text-primary" />
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
							Invited on{" "}
							{invitation.createdAt
								? formatDisplayDate(invitation.createdAt)
								: "Unknown date"}
						</span>
					</div>
					{isPending && (
						<div className="mt-1 flex items-center gap-2">
							<Clock4Icon className="h-3.5 w-3.5" />
							<span>Expires on {formatDisplayDate(invitation.expiresAt)}</span>
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
