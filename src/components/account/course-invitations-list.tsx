import { useSuspenseQuery } from "@tanstack/react-query";
import { BadgeCheck, BadgeX, ClipboardList, SearchXIcon } from "lucide-react";
import { Placeholder } from "@/components/placeholders/placeholder";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { orpc } from "@/lib/orpc/orpc";
import type { CourseInvitation } from "@/lib/orpc/schemas/course-invitations";
import { CourseInvitationEntry } from "./course-invitation-entry";

const CourseInvitationsList = () => {
	const { data: courseInvitations } = useSuspenseQuery(
		orpc.courseInvitation.list.queryOptions({
			input: { pageIndex: 0, pageSize: 100 },
		}),
	);

	if (courseInvitations.data.length === 0) {
		return (
			<Placeholder Icon={SearchXIcon} size={30}>
				You have no course invitations at this time.
			</Placeholder>
		);
	}

	// Group invitations by status
	const pendingInvitations = courseInvitations.data.filter(
		(inv) => inv.status === "pending",
	);
	const acceptedInvitations = courseInvitations.data.filter(
		(inv) => inv.status === "accepted",
	);
	const rejectedInvitations = courseInvitations.data.filter(
		(inv) => inv.status === "rejected",
	);

	const renderInvitationList = (
		filteredInvitations: CourseInvitation[],
		emptyMessage: string,
	) => {
		if (filteredInvitations.length === 0) {
			return (
				<Placeholder Icon={SearchXIcon} size={30}>
					{emptyMessage}
				</Placeholder>
			);
		}

		return (
			<div className="flex flex-col space-y-4">
				{filteredInvitations.map((invitation) => (
					<CourseInvitationEntry key={invitation.id} invitation={invitation} />
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
};

export { CourseInvitationsList };
