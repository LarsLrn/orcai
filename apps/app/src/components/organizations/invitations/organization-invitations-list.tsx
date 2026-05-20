import type { OrganizationInvitation } from "@orcai/schema";
import { useSuspenseQuery } from "@tanstack/react-query";
import { BadgeCheck, BadgeX, ClipboardList, SearchXIcon } from "lucide-react";
import { Placeholder } from "@/components/placeholders/placeholder";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { authClient } from "@/lib/auth/auth-client";
import { orpc } from "@/lib/orpc/orpc";
import { OrganizationInvitationEntry } from "./organization-invitation-entry";

type OrganizationInvitationsListProps = {
	mode?: "all" | "pending";
	onAccepted?: () => void | Promise<void>;
	emptyTitle?: string;
	emptyDescription?: string;
};

const toTimestamp = (date: Date | null | undefined) =>
	date ? date.getTime() : Number.NEGATIVE_INFINITY;

export function OrganizationInvitationsList({
	mode = "all",
	onAccepted,
	emptyTitle = "No Invitations",
	emptyDescription = "You don't have any organisation invitations at this time.",
}: OrganizationInvitationsListProps) {
	const { data: session } = authClient.useSession();
	const currentUserEmail = session?.user?.email.trim().toLowerCase();

	const { data: invitationResponse } = useSuspenseQuery(
		orpc.organizationInvitation.list.queryOptions({
			input: {
				pageIndex: 0,
				pageSize: 100,
			},
		}),
	);

	const ownInvitations = invitationResponse.data
		.filter((invitation) =>
			currentUserEmail
				? invitation.email.trim().toLowerCase() === currentUserEmail
				: false,
		)
		.sort((a, b) => toTimestamp(b.createdAt) - toTimestamp(a.createdAt));

	const pendingInvitations = ownInvitations.filter(
		(invitation) => invitation.status === "pending",
	);
	const acceptedInvitations = ownInvitations.filter(
		(invitation) => invitation.status === "accepted",
	);
	const rejectedInvitations = ownInvitations.filter(
		(invitation) => invitation.status === "rejected",
	);

	if (mode === "pending") {
		if (pendingInvitations.length === 0) {
			return <Placeholder title={emptyTitle} description={emptyDescription} />;
		}

		return (
			<div className="flex flex-col space-y-4">
				{pendingInvitations.map((invitation) => (
					<OrganizationInvitationEntry
						key={invitation.id}
						invitation={invitation}
						onAccepted={onAccepted}
					/>
				))}
			</div>
		);
	}

	if (ownInvitations.length === 0) {
		return <Placeholder title={emptyTitle} description={emptyDescription} />;
	}

	const renderInvitationList = (
		filteredInvitations: OrganizationInvitation[],
		emptyMessage: string,
	) => {
		if (filteredInvitations.length === 0) {
			return (
				<Placeholder
					title="No Invitations"
					description={emptyMessage}
					Icon={SearchXIcon}
				/>
			);
		}

		return (
			<div className="flex flex-col space-y-4">
				{filteredInvitations.map((invitation) => (
					<OrganizationInvitationEntry
						key={invitation.id}
						invitation={invitation}
						onAccepted={onAccepted}
					/>
				))}
			</div>
		);
	};

	return (
		<Tabs defaultValue="pending" className="w-full">
			<TabsList className="mb-6 grid w-full grid-cols-3">
				<TabsTrigger value="pending" className="flex items-center gap-2">
					<ClipboardList className="h-4 w-4" />
					<span className="hidden sm:inline">Pending</span>
					{pendingInvitations.length > 0 && (
						<span className="ml-1 rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary text-xs">
							{pendingInvitations.length}
						</span>
					)}
				</TabsTrigger>
				<TabsTrigger value="accepted" className="flex items-center gap-2">
					<BadgeCheck className="h-4 w-4" />
					<span className="hidden sm:inline">Accepted</span>
					{acceptedInvitations.length > 0 && (
						<span className="ml-1 rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary text-xs">
							{acceptedInvitations.length}
						</span>
					)}
				</TabsTrigger>
				<TabsTrigger value="rejected" className="flex items-center gap-2">
					<BadgeX className="h-4 w-4" />
					<span className="hidden sm:inline">Rejected</span>
					{rejectedInvitations.length > 0 && (
						<span className="ml-1 rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary text-xs">
							{rejectedInvitations.length}
						</span>
					)}
				</TabsTrigger>
			</TabsList>
			<TabsContent value="pending" className="space-y-4 px-1">
				{renderInvitationList(
					pendingInvitations,
					"You don't have any pending invitations.",
				)}
			</TabsContent>
			<TabsContent value="accepted" className="space-y-4 px-1">
				{renderInvitationList(
					acceptedInvitations,
					"You don't have any accepted invitations.",
				)}
			</TabsContent>
			<TabsContent value="rejected" className="space-y-4 px-1">
				{renderInvitationList(
					rejectedInvitations,
					"You don't have any rejected invitations.",
				)}
			</TabsContent>
		</Tabs>
	);
}
