import type { OrganizationInvitationStatus } from "@orcai/schema";
import { useSuspenseQuery } from "@tanstack/react-query";
import { BadgeCheck, BadgeX, ClipboardList } from "lucide-react";
import { startTransition, useEffect, useState } from "react";
import { Placeholder } from "@/components/placeholders/placeholder";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";
import { OrganizationInvitationEntry } from "./organization-invitation-entry";

const PAGE_SIZE = 12;

export const invitationsPageInput = (params?: {
	pageIndex?: number;
	status?: OrganizationInvitationStatus;
}) => ({
	filters: {
		status: params?.status,
	},
	pageIndex: params?.pageIndex ?? 0,
	pageSize: PAGE_SIZE,
});

type OrganizationInvitationsListProps = {
	mode?: "all" | "pending";
	onAccepted?: () => void | Promise<void>;
	emptyTitle?: string;
	emptyDescription?: string;
};

const invitationTabs = [
	{
		status: "pending",
		label: () => m.orgs_invitation_status_pending(),
		Icon: ClipboardList,
	},
	{
		status: "accepted",
		label: () => m.orgs_invitation_status_accepted(),
		Icon: BadgeCheck,
	},
	{
		status: "rejected",
		label: () => m.orgs_invitation_status_rejected(),
		Icon: BadgeX,
	},
] as const;

function InvitationPage({
	status,
	onAccepted,
	emptyTitle,
	emptyDescription,
}: Pick<OrganizationInvitationsListProps, "onAccepted"> & {
	emptyTitle: string;
	emptyDescription: string;
	status: OrganizationInvitationStatus;
}) {
	const [pageIndex, setPageIndex] = useState(0);
	const { data: response } = useSuspenseQuery(
		orpc.organizationInvitation.listMine.queryOptions({
			input: invitationsPageInput({
				pageIndex,
				status,
			}),
		}),
	);
	const pageCount = Math.max(1, Math.ceil(response.rowCount / PAGE_SIZE));
	useEffect(() => {
		if (pageIndex >= pageCount) {
			startTransition(() => setPageIndex(pageCount - 1));
		}
	}, [
		pageIndex,
		pageCount,
	]);

	return (
		<div className="flex flex-col space-y-4">
			{response.data.length === 0 ? (
				<Placeholder title={emptyTitle} description={emptyDescription} />
			) : (
				response.data.map((invitation) => (
					<OrganizationInvitationEntry
						key={invitation.id}
						invitation={invitation}
						onAccepted={onAccepted}
					/>
				))
			)}
			{(pageCount > 1 || pageIndex > 0) && (
				<nav
					aria-label={m.orgs_invitations_pagination_aria_label()}
					className="flex items-center justify-center gap-4"
				>
					<Button
						variant="outline"
						disabled={pageIndex === 0}
						onClick={() =>
							startTransition(() => setPageIndex((index) => index - 1))
						}
					>
						{m.orgs_invitations_pagination_previous_button()}
					</Button>
					<span className="text-muted-foreground text-sm">
						{m.orgs_invitations_pagination_position({
							page: Math.min(pageIndex + 1, pageCount),
							pageCount,
						})}
					</span>
					<Button
						variant="outline"
						disabled={pageIndex >= pageCount - 1}
						onClick={() =>
							startTransition(() => setPageIndex((index) => index + 1))
						}
					>
						{m.common_next_button()}
					</Button>
				</nav>
			)}
		</div>
	);
}

export function OrganizationInvitationsList({
	mode = "all",
	onAccepted,
	emptyTitle = m.orgs_invitations_empty_state_title(),
	emptyDescription = m.orgs_invitations_empty_state_description(),
}: OrganizationInvitationsListProps) {
	if (mode === "pending")
		return (
			<InvitationPage
				status="pending"
				onAccepted={onAccepted}
				emptyTitle={emptyTitle}
				emptyDescription={emptyDescription}
			/>
		);
	return (
		<Tabs defaultValue="pending" className="w-full">
			<TabsList className="mb-6 grid w-full grid-cols-3">
				{invitationTabs.map(({ status, label, Icon }) => (
					<TabsTrigger
						key={status}
						value={status}
						className="flex items-center gap-2"
					>
						<Icon className="h-4 w-4" />
						<span>{label()}</span>
					</TabsTrigger>
				))}
			</TabsList>
			{invitationTabs.map(({ status }) => (
				<TabsContent key={status} value={status} className="space-y-4 px-1">
					<InvitationPage
						status={status}
						onAccepted={onAccepted}
						emptyTitle={emptyTitle}
						emptyDescription={m.orgs_invitations_status_empty_state_description(
							{
								status,
							},
						)}
					/>
				</TabsContent>
			))}
		</Tabs>
	);
}
