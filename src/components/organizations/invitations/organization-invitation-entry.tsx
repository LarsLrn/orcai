import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
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
import { Spinner } from "@/components/ui/spinner";
import { orpc } from "@/lib/orpc/orpc";
import type { OrganizationInvitation } from "@/lib/orpc/schemas/organization-invitation";
import { OrganizationInvitationActions } from "./organization-invitation-actions";

type OrganizationInvitationEntryProps = {
	invitation: OrganizationInvitation;
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
	const { data: organization, status } = useQuery(
		orpc.organization.find.queryOptions({
			input: {
				id: invitation.organizationId,
			},
		}),
	);

	const isPending = invitation.status === "pending";
	const isExpired = isPending && invitation.expiresAt < new Date();

	if (status === "pending") {
		return <Spinner />;
	}

	return (
		<Card className="w-full">
			<CardHeader className="pb-2">
				<div className="flex items-center justify-between gap-2">
					<div className="flex items-center gap-2">
						<Building2Icon className="h-4 w-4 text-primary" />
						<CardTitle className="text-lg">
							{organization?.data.name ?? "Organization"}
						</CardTitle>
					</div>
					<Badge variant={toBadgeVariant(invitation.status, isExpired)}>
						{toDisplayStatus(invitation.status, isExpired)}
					</Badge>
				</div>
				<CardDescription className="text-xs">
					{organization?.data.slug
						? `@${organization.data.slug}`
						: invitation.organizationId}
				</CardDescription>
			</CardHeader>
			<CardContent className="py-2">
				<div className="flex flex-col text-muted-foreground text-sm">
					<div className="flex items-center gap-2">
						<CalendarIcon className="h-3.5 w-3.5" />
						<span>
							Invited on{" "}
							{invitation.createdAt
								? format(invitation.createdAt, "MMM d, yyyy")
								: "Unknown date"}
						</span>
					</div>
					{isPending && (
						<div className="mt-1 flex items-center gap-2">
							<Clock4Icon className="h-3.5 w-3.5" />
							<span>
								Expires on {format(invitation.expiresAt, "MMM d, yyyy")}
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
