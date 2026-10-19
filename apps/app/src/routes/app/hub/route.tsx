import {
	createFileRoute,
	type LinkProps,
	Outlet,
	useNavigate,
} from "@tanstack/react-router";
import {
	BotIcon,
	BrainCircuitIcon,
	DatabaseIcon,
	FileTextIcon,
	LibraryIcon,
	type LucideIcon,
} from "lucide-react";
import { LoadingPage } from "@/components/app/loading/loading-page";
import { OptionPicker } from "@/components/ui/composed/option-picker";
import {
	Hero,
	HeroContent,
	HeroInner,
	HeroWave,
} from "@/components/ui/shell/hero";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSectionPathname } from "@/hooks/use-section-pathname";
import { m } from "@/paraglide/messages";

const HUB_ROUTES = [
	{
		value: "all",
		to: "/app/hub",
		Icon: LibraryIcon,
		iconClassName: "text-muted-foreground",
	},
	{
		value: "bots",
		to: "/app/hub/bots",
		Icon: BotIcon,
		iconClassName: "text-kind-bot",
	},
	{
		value: "behaviour",
		to: "/app/hub/behaviour",
		Icon: BrainCircuitIcon,
		iconClassName: "text-kind-behaviour",
	},
	{
		value: "repositories",
		to: "/app/hub/repositories",
		Icon: DatabaseIcon,
		iconClassName: "text-kind-repository",
	},
	{
		value: "assets",
		to: "/app/hub/assets",
		Icon: FileTextIcon,
		iconClassName: "text-kind-asset",
	},
] satisfies {
	value: string;
	to: LinkProps["to"];
	Icon: LucideIcon;
	iconClassName: string;
}[];

const getHubRouteLabel = (value: TabValue) => {
	switch (value) {
		case "bots":
			return m.hub_tab_bots_label();
		case "behaviour":
			return m.hub_tab_behaviour_label();
		case "repositories":
			return m.hub_tab_repositories_label();
		case "assets":
			return m.hub_tab_assets_label();
		default:
			return m.hub_tab_all_label();
	}
};

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
				title: m.hub_page_title(),
			},
		],
	}),
	component: RouteComponent,
	pendingComponent: LoadingPage,
});

function RouteComponent() {
	const navigate = useNavigate();
	const activeTab = getActiveTab(useSectionPathname());
	const hubRouteItems = HUB_ROUTES.map((route) => ({
		...route,
		label: getHubRouteLabel(route.value),
	}));
	const navigateToRoute = (value: string | null) => {
		if (!value) return;
		const route = HUB_ROUTES.find((candidate) => candidate.value === value);
		if (route)
			navigate({
				to: route.to,
			});
	};

	return (
		<div className="flex flex-col gap-8">
			<Hero>
				<HeroWave />
				<HeroInner className="pb-10">
					<HeroContent className="@container flex justify-between sm:flex-row">
						<h1 className="font-heading font-semibold text-4xl text-card-foreground tracking-tight">
							{m.hub_page_title()}
						</h1>
						<OptionPicker
							options={hubRouteItems}
							value={activeTab}
							onChange={navigateToRoute}
							aria-label={m.hub_section_switcher_aria_label()}
							className="@2xl:hidden w-full"
						/>
						<Tabs
							className="@2xl:flex hidden"
							value={activeTab}
							onValueChange={navigateToRoute}
						>
							<TabsList>
								{hubRouteItems.map((route) => (
									<TabsTrigger key={route.value} value={route.value}>
										<route.Icon className={route.iconClassName} />
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
