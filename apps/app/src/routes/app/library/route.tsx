import {
	createFileRoute,
	type LinkProps,
	Outlet,
	useNavigate,
	useRouterState,
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
import { m } from "@/paraglide/messages";

const LIBRARY_ROUTES = [
	{
		value: "all",
		to: "/app/library",
		Icon: LibraryIcon,
		iconClassName: "text-muted-foreground",
	},
	{
		value: "bots",
		to: "/app/library/bots",
		Icon: BotIcon,
		iconClassName: "text-kind-bot",
	},
	{
		value: "behaviour",
		to: "/app/library/behaviours",
		Icon: BrainCircuitIcon,
		iconClassName: "text-kind-behaviour",
	},
	{
		value: "repositories",
		to: "/app/library/repositories",
		Icon: DatabaseIcon,
		iconClassName: "text-kind-repository",
	},
	{
		value: "assets",
		to: "/app/library/assets",
		Icon: FileTextIcon,
		iconClassName: "text-kind-asset",
	},
] satisfies {
	value: string;
	to: LinkProps["to"];
	Icon: LucideIcon;
	iconClassName: string;
}[];

const getLibraryRouteLabel = (value: TabValue) => {
	switch (value) {
		case "bots":
			return m.library_tab_bots_label();
		case "behaviour":
			return m.library_tab_behaviour_label();
		case "repositories":
			return m.library_tab_repositories_label();
		case "assets":
			return m.library_tab_assets_label();
		default:
			return m.library_tab_all_label();
	}
};

type TabValue = (typeof LIBRARY_ROUTES)[number]["value"];

function getActiveTab(pathname: string): TabValue {
	if (pathname === "/app/library") return "all";
	const match = LIBRARY_ROUTES.find(
		(route) => route.value !== "all" && pathname.startsWith(route.to),
	);
	return match?.value ?? "all";
}

export const Route = createFileRoute("/app/library")({
	head: () => ({
		meta: [
			{
				title: m.library_page_title(),
			},
		],
	}),
	component: RouteComponent,
	pendingComponent: LoadingPage,
});

function RouteComponent() {
	const navigate = useNavigate();
	const activeTab = getActiveTab(
		useRouterState({
			select: (state) => state.location.pathname,
		}),
	);
	const libraryRouteItems = LIBRARY_ROUTES.map((route) => ({
		...route,
		label: getLibraryRouteLabel(route.value),
	}));
	const navigateToRoute = (value: string | null) => {
		if (!value) return;
		const route = LIBRARY_ROUTES.find((candidate) => candidate.value === value);
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
							{m.library_page_title()}
						</h1>
						<OptionPicker
							options={libraryRouteItems}
							value={activeTab}
							onChange={navigateToRoute}
							aria-label={m.library_section_switcher_aria_label()}
							className="@2xl:hidden w-full"
						/>
						<Tabs
							className="@2xl:flex hidden"
							value={activeTab}
							onValueChange={navigateToRoute}
						>
							<TabsList>
								{libraryRouteItems.map((route) => (
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
