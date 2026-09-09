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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
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
		Icon: LibraryIcon,
		iconClassName: "text-muted-foreground",
	},
	{
		value: "bots",
		label: "Bots",
		to: "/app/hub/bots",
		Icon: BotIcon,
		iconClassName: "text-kind-bot",
	},
	{
		value: "behaviour",
		label: "Behaviour",
		to: "/app/hub/behaviour",
		Icon: BrainCircuitIcon,
		iconClassName: "text-kind-behaviour",
	},
	{
		value: "repositories",
		label: "Repositories",
		to: "/app/hub/repositories",
		Icon: DatabaseIcon,
		iconClassName: "text-kind-repository",
	},
	{
		value: "assets",
		label: "Assets",
		to: "/app/hub/assets",
		Icon: FileTextIcon,
		iconClassName: "text-kind-asset",
	},
] satisfies {
	value: string;
	label: string;
	to: LinkProps["to"];
	Icon: LucideIcon;
	iconClassName: string;
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
	pendingComponent: LoadingPage,
});

function RouteComponent() {
	const navigate = useNavigate();
	const pathname = useRouterState({
		select: (s) => s.location.pathname,
	});
	const activeTab = getActiveTab(pathname);
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
					<HeroContent className="flex justify-between sm:flex-row">
						<h1 className="font-heading font-semibold text-4xl text-card-foreground tracking-tight">
							Library
						</h1>
						<Select
							value={activeTab}
							onValueChange={navigateToRoute}
							items={HUB_ROUTES}
						>
							<SelectTrigger
								className="w-full md:hidden"
								aria-label="Library section"
							>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{HUB_ROUTES.map((route) => (
									<SelectItem key={route.value} value={route.value}>
										{route.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<Tabs
							className="hidden md:flex"
							value={activeTab}
							onValueChange={navigateToRoute}
						>
							<TabsList>
								{HUB_ROUTES.map((route) => (
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
