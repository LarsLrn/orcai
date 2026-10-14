import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
	BadgeIcon,
	CalendarIcon,
	MailCheckIcon,
	MailIcon,
	UserIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Page,
	PageContent,
	PageHeader,
	PageTitle,
} from "@/components/ui/shell/page";
import { ManageUser } from "@/components/users/manage-user";
import { UserAccessOverview } from "@/components/users/user-access-overview";
import { orpc } from "@/lib/orpc/orpc";
import { formatDisplayDate } from "@/lib/presentation/format-timestamp";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/app/users/$userId/edit")({
	component: RouteComponent,
	head: () => ({
		meta: [
			{
				title: m.users_edit_page_meta_title(),
			},
		],
	}),
});

function RouteComponent() {
	const { userId } = Route.useParams();
	const { data: user } = useSuspenseQuery(
		orpc.user.find.queryOptions({
			input: {
				id: userId,
			},
		}),
	);

	return (
		<Page>
			<PageHeader>
				<PageTitle>{m.users_edit_page_title()}</PageTitle>
			</PageHeader>

			<PageContent className="flex flex-col gap-4">
				<Card>
					<CardHeader>
						<CardTitle>{m.users_edit_details_title()}</CardTitle>
					</CardHeader>
					<CardContent className="flex flex-col gap-4">
						<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
							<div className="flex items-center gap-2">
								<UserIcon className="h-4 w-4 text-primary" />
								<div className="space-y-0.5">
									<p className="font-medium text-sm">{m.common_name_label()}</p>
									<p className="text-muted-foreground text-sm">
										{user.data.name}
									</p>
								</div>
							</div>

							<div className="flex items-center gap-2">
								<MailIcon className="h-4 w-4 text-primary" />
								<div className="space-y-0.5">
									<p className="font-medium text-sm">
										{m.common_email_label()}
									</p>
									<p className="text-muted-foreground text-sm">
										{user.data.email}
									</p>
								</div>
							</div>

							<div className="flex items-center gap-2">
								<BadgeIcon className="h-4 w-4 text-primary" />
								<div className="space-y-0.5">
									<p className="font-medium text-sm">
										{m.users_edit_details_status_label()}
									</p>
									<div className="flex items-center gap-2">
										<span
											className={`h-2 w-2 rounded-full ${user.data.banned ? "bg-destructive" : "bg-green-500"}`}
										/>
										<p className="text-muted-foreground text-sm">
											{user.data.banned
												? m.users_edit_details_status_banned()
												: m.users_edit_details_status_active()}
										</p>
									</div>
								</div>
							</div>

							<div className="flex items-center gap-2">
								<MailCheckIcon className="h-4 w-4 text-primary" />
								<div className="space-y-0.5">
									<p className="font-medium text-sm">
										{m.users_edit_details_verification_label()}
									</p>
									<p className="text-muted-foreground text-sm">
										{user.data.emailVerified
											? m.users_verification_verified()
											: m.users_verification_not_verified()}
									</p>
								</div>
							</div>

							<div className="flex items-center gap-2">
								<CalendarIcon className="h-4 w-4 text-primary" />
								<div className="space-y-0.5">
									<p className="font-medium text-sm">
										{m.users_edit_details_created_label()}
									</p>
									<p className="text-muted-foreground text-sm">
										{formatDisplayDate(user.data.createdAt)}
									</p>
								</div>
							</div>

							<div className="flex items-center gap-2">
								<CalendarIcon className="h-4 w-4 text-primary" />
								<div className="space-y-0.5">
									<p className="font-medium text-sm">
										{m.users_edit_details_updated_label()}
									</p>
									<p className="text-muted-foreground text-sm">
										{formatDisplayDate(user.data.updatedAt)}
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
