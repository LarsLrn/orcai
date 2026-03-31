import { createFileRoute } from "@tanstack/react-router";
import { LayoutDashboardIcon, MessageSquareIcon } from "lucide-react";
import { useState } from "react";
import { ManagerHome } from "@/components/app/home/manager-home";
import { UserHome } from "@/components/app/home/user-home";
import { Page, PageContent } from "@/components/ui/shell/page";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { orpc } from "@/lib/orpc/orpc";

const PREFETCH_PARAMS = {
	pageIndex: 0,
	pageSize: 6,
} as const;

const SUMMARY_PARAMS = {
	pageIndex: 0,
	pageSize: 1,
} as const;

export const Route = createFileRoute("/app/")({
	loader: async ({ context: { queryClient } }) => {
		await Promise.all([
			queryClient.ensureQueryData(
				orpc.bot.list.queryOptions({
					input: PREFETCH_PARAMS,
				}),
			),
			queryClient.ensureQueryData(
				orpc.block.list.queryOptions({
					input: SUMMARY_PARAMS,
				}),
			),
			queryClient.ensureQueryData(
				orpc.asset.list.queryOptions({
					input: SUMMARY_PARAMS,
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
			<PageContent className="space-y-8">
				<div className="flex justify-end">
					<Tabs
						value={view}
						onValueChange={(value) => setView(value as HomeView)}
					>
						<TabsList>
							<TabsTrigger value="user">
								<MessageSquareIcon />
								Use
							</TabsTrigger>
							<TabsTrigger value="manager">
								<LayoutDashboardIcon />
								Manage
							</TabsTrigger>
						</TabsList>
					</Tabs>
				</div>

				{view === "user" ? <UserHome /> : <ManagerHome />}
			</PageContent>
		</Page>
	);
}
