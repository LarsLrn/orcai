import { createFileRoute } from "@tanstack/react-router";
import { LayoutDashboardIcon, MessageSquareIcon } from "lucide-react";
import { useState } from "react";
import { ManagerHome } from "@/components/app/home/manager-home";
import { UserHome } from "@/components/app/home/user-home";
import { Page, PageContent } from "@/components/ui/shell/page";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

const PREFETCH_PARAMS = {
	pageIndex: 0,
	pageSize: 6,
	sort: "favouritesFirst",
} as const;

const SUMMARY_PARAMS = {
	pageIndex: 0,
	pageSize: 1,
	filters: {
		origin: "library",
	},
} as const;

export const Route = createFileRoute("/app/")({
	loader: async ({ context: { queryClient } }) => {
		await Promise.all([
			queryClient.query(
				orpc.bot.list.queryOptions({
					input: PREFETCH_PARAMS,
					staleTime: "static",
				}),
			),
			queryClient.query(
				orpc.asset.list.queryOptions({
					input: SUMMARY_PARAMS,
					staleTime: "static",
				}),
			),
		]);
	},
	component: RouteComponent,
});

type HomeView = "user" | "manager";

function RouteComponent() {
	const [view, setView] = useState<HomeView>("user");

	return (
		<Page>
			<PageContent>
				<Tabs
					className="gap-8"
					value={view}
					onValueChange={(value) => setView(value as HomeView)}
				>
					<div className="flex justify-end">
						<TabsList>
							<TabsTrigger value="user">
								<MessageSquareIcon />
								{m.home_view_use_tab()}
							</TabsTrigger>
							<TabsTrigger value="manager">
								<LayoutDashboardIcon />
								{m.home_view_manage_tab()}
							</TabsTrigger>
						</TabsList>
					</div>
					<TabsContent value="user" className="text-base">
						<UserHome />
					</TabsContent>
					<TabsContent value="manager" className="text-base">
						<ManagerHome />
					</TabsContent>
				</Tabs>
			</PageContent>
		</Page>
	);
}
