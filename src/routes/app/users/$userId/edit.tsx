import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import {
	BadgeIcon,
	CalendarIcon,
	ClockIcon,
	MailIcon,
	UserIcon,
} from "lucide-react";
import {
	Page,
	PageContent,
	PageHeader,
	PageTitle,
} from "@/components/app/page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ManageUser } from "@/components/users/manage-user";
import { UserAccessOverview } from "@/components/users/user-access-overview";
import { orpc } from "@/lib/orpc/orpc";

export const Route = createFileRoute("/app/users/$userId/edit")({
	component: RouteComponent,
	head: () => ({
		meta: [
			{
				title: "Edit",
			},
		],
	}),
});

function RouteComponent() {
	const { userId } = Route.useParams();
	const { data: user } = useSuspenseQuery(
		orpc.user.find.queryOptions({
			input: { id: userId },
		}),
	);

	return (
		<Page>
			<PageHeader>
				<PageTitle>Edit User</PageTitle>
			</PageHeader>

			<PageContent className="flex flex-col gap-4">
				<Card>
					<CardHeader>
						<CardTitle>User Information</CardTitle>
					</CardHeader>
					<CardContent className="flex flex-col gap-4">
						<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
							<div className="flex items-center gap-2">
								<UserIcon className="h-4 w-4 text-primary" />
								<div className="space-y-0.5">
									<p className="font-medium text-sm">Name</p>
									<p className="text-muted-foreground text-sm">
										{user.data.name}
									</p>
								</div>
							</div>

							<div className="flex items-center gap-2">
								<MailIcon className="h-4 w-4 text-primary" />
								<div className="space-y-0.5">
									<p className="font-medium text-sm">Email</p>
									<p className="text-muted-foreground text-sm">
										{user.data.email}
									</p>
								</div>
							</div>

							<div className="flex items-center gap-2">
								<BadgeIcon className="h-4 w-4 text-primary" />
								<div className="space-y-0.5">
									<p className="font-medium text-sm">Status</p>
									<div className="flex items-center gap-2">
										<span
											className={`h-2 w-2 rounded-full ${user.data.banned ? "bg-destructive" : "bg-green-500"}`}
										/>
										<p className="text-muted-foreground text-sm">
											{user.data.banned ? "Banned" : "Active"}
										</p>
									</div>
								</div>
							</div>

							{typeof user.data.emailVerified === "string" && (
								<div className="flex items-center gap-2">
									<ClockIcon className="h-4 w-4 text-primary" />
									<div className="space-y-0.5">
										<p className="font-medium text-sm">Email Verification</p>
										<p className="text-muted-foreground text-sm">
											Verified on{" "}
											{format(user.data.emailVerified, "MMM d, yyyy")}
										</p>
									</div>
								</div>
							)}

							<div className="flex items-center gap-2">
								<CalendarIcon className="h-4 w-4 text-primary" />
								<div className="space-y-0.5">
									<p className="font-medium text-sm">Created At</p>
									<p className="text-muted-foreground text-sm">
										{format(user.data.createdAt, "MMM d, yyyy")}
									</p>
								</div>
							</div>

							<div className="flex items-center gap-2">
								<CalendarIcon className="h-4 w-4 text-primary" />
								<div className="space-y-0.5">
									<p className="font-medium text-sm">Updated At</p>
									<p className="text-muted-foreground text-sm">
										{format(user.data.updatedAt, "MMM d, yyyy")}
									</p>
								</div>
							</div>
						</div>
					</CardContent>
				</Card>

				<UserAccessOverview userId={userId} />
				<ManageUser user={user.data} />
			</PageContent>
		</Page>
	);
}
