import {
	createFileRoute,
	type LinkProps,
	Outlet,
	useNavigate,
	useRouterState,
} from "@tanstack/react-router";
import {
	Page,
	PageAction,
	PageContent,
	PageDescription,
	PageHeader,
	PageTitle,
} from "@/components/ui/shell/page";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const HUB_ROUTES = [
	{
		value: "all",
		label: "All",
		to: "/app/hub",
	},
	{
		value: "bots",
		label: "Bots",
		to: "/app/hub/bots",
	},
	{
		value: "blocks",
		label: "Blocks",
		to: "/app/hub/blocks",
	},
	{
		value: "assets",
		label: "Content",
		to: "/app/hub/assets",
	},
] satisfies {
	value: string;
	label: string;
	to: LinkProps["to"];
}[];

type TabValue = (typeof HUB_ROUTES)[number]["value"];

function getActiveTab(pathname: string): TabValue {
	if (pathname === "/app/hub") return "all";
	const match = HUB_ROUTES.find(
		(route) => route.value !== "all" && pathname.startsWith(route.to),
	);
	return match?.value ?? "all";
}

export const Route = createFileRoute("/app/hub")({
	head: () => ({
		meta: [
			{
				title: "Library",
			},
		],
	}),
	component: RouteComponent,
});

function RouteComponent() {
	const navigate = useNavigate();
	const pathname = useRouterState({
		select: (s) => s.location.pathname,
	});
	const activeTab = getActiveTab(pathname);

	return (
		<Page>
			<PageHeader>
				<PageTitle>Library</PageTitle>
				<PageDescription>
					Browse reusable bots, blocks, and content for your workspace.
				</PageDescription>
				<PageAction>
					<Tabs
						value={activeTab}
						onValueChange={(value) => {
							const route = HUB_ROUTES.find((r) => r.value === value);
							if (route)
								navigate({
									to: route.to,
								});
						}}
					>
						<TabsList className="shadow-md">
							{HUB_ROUTES.map((route) => (
								<TabsTrigger key={route.value} value={route.value}>
									{route.label}
								</TabsTrigger>
							))}
						</TabsList>
					</Tabs>
				</PageAction>
			</PageHeader>
			<PageContent>
				<Outlet />
			</PageContent>
		</Page>
	);
}
