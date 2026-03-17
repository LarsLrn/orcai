import {
	createFileRoute,
	type LinkProps,
	Outlet,
	useNavigate,
	useRouterState,
} from "@tanstack/react-router";
import { BotIcon, FolderOpenIcon, LayersIcon } from "lucide-react";
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
					<HeroContent>
						<div className="space-y-3">
							<p className="font-semibold text-primary text-sm uppercase tracking-[0.18em]">
								OrcAI
							</p>
							<h1 className="font-bold text-4xl text-card-foreground tracking-tight">
								Library
							</h1>
							<p className="max-w-xl text-base text-card-foreground/70 leading-relaxed">
								Browse and manage the bots, behaviour blocks, knowledge bases,
								and content that power your workspace.
							</p>
						</div>
						<div className="flex flex-wrap items-center gap-6 text-card-foreground/50 text-sm">
							<div className="flex items-center gap-1.5">
								<BotIcon className="size-4" />
								<span>Bots</span>
							</div>
							<div className="flex items-center gap-1.5">
								<LayersIcon className="size-4" />
								<span>Blocks</span>
							</div>
							<div className="flex items-center gap-1.5">
								<FolderOpenIcon className="size-4" />
								<span>Content</span>
							</div>
						</div>
					</HeroContent>
				</HeroInner>
			</Hero>

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

			<Outlet />
		</div>
	);
}
