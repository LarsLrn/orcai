import {
	createFileRoute,
	type LinkProps,
	Outlet,
	useNavigate,
	useRouterState,
} from "@tanstack/react-router";
import {
	Hero,
	HeroContent,
	HeroInner,
	HeroWave,
} from "@/components/ui/shell/hero";
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
		<div className="flex flex-col gap-8">
			<Hero>
				<HeroWave />
				<HeroInner className="pb-10">
					<HeroContent className="flex justify-between sm:flex-row">
						<h1 className="font-bold text-4xl text-card-foreground tracking-tight">
							Library
						</h1>
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
							<TabsList>
								{HUB_ROUTES.map((route) => (
									<TabsTrigger key={route.value} value={route.value}>
										{route.label}
									</TabsTrigger>
								))}
							</TabsList>
						</Tabs>
					</HeroContent>
				</HeroInner>
			</Hero>

			<Outlet />
		</div>
	);
}
