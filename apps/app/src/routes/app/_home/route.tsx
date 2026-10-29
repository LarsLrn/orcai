import { useQuery } from "@tanstack/react-query";
import {
	createFileRoute,
	Link,
	Outlet,
	useRouterState,
} from "@tanstack/react-router";
import { LayoutDashboardIcon, MessageSquareIcon } from "lucide-react";
import {
	failingRequired,
	readinessQuery,
} from "@/components/readiness/organization-readiness-card";
import { Badge } from "@/components/ui/badge";
import { Page, PageContent } from "@/components/ui/shell/page";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { hasCapability } from "@/lib/authz/capabilities";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/app/_home")({
	beforeLoad: async ({ context: { queryClient } }) => {
		const { data } = await queryClient.query(
			orpc.authorization.organizationCapabilities.queryOptions({
				input: {
					permissions: [
						"manage_organization",
					],
				},
			}),
		);
		const isOrganizationAdmin = hasCapability(
			data.capabilities,
			"manage_organization",
		);
		if (isOrganizationAdmin) {
			await queryClient.query(readinessQuery());
		}
		return {
			isOrganizationAdmin,
		};
	},
	component: RouteComponent,
});

/** The number of setup steps that keep members from chatting, for admins. */
const ReadinessBadge = () => {
	const { data } = useQuery(readinessQuery());
	const count = data ? failingRequired(data.data.checks) : 0;

	if (count === 0) {
		return null;
	}

	return (
		<Badge
			variant="danger"
			aria-label={m.home_manage_tab_failing_badge_label({
				count,
			})}
		>
			{count}
		</Badge>
	);
};

function RouteComponent() {
	const { isOrganizationAdmin } = Route.useRouteContext();
	const view = useRouterState({
		select: (state) =>
			state.location.pathname.startsWith("/app/manage") ? "manage" : "use",
	});

	return (
		<Page>
			<PageContent>
				<Tabs className="gap-8" value={view}>
					<div className="flex justify-end">
						<TabsList>
							<TabsTrigger
								value="use"
								nativeButton={false}
								render={
									<Link
										to="/app"
										search={{
											view: "use",
										}}
									/>
								}
							>
								<MessageSquareIcon />
								{m.home_view_use_tab()}
							</TabsTrigger>
							<TabsTrigger
								value="manage"
								nativeButton={false}
								render={<Link to="/app/manage" />}
							>
								<LayoutDashboardIcon />
								{m.home_view_manage_tab()}
								{isOrganizationAdmin && <ReadinessBadge />}
							</TabsTrigger>
						</TabsList>
					</div>
					<div className="text-base">
						<Outlet />
					</div>
				</Tabs>
			</PageContent>
		</Page>
	);
}
