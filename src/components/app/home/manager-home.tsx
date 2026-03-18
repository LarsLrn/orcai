import { useSuspenseQuery } from "@tanstack/react-query";
import type { LinkProps } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import {
	BlocksIcon,
	BotIcon,
	DatabaseIcon,
	FileTextIcon,
	FolderOpenIcon,
	type LucideIcon,
	SparklesIcon,
	UsersIcon,
} from "lucide-react";
import { Suspense } from "react";
import { SkeletonsArray } from "@/components/placeholders/skeletons-array";
import { Badge } from "@/components/ui/badge";
import {
	Item,
	ItemContent,
	ItemDescription,
	ItemMedia,
	ItemTitle,
} from "@/components/ui/item";
import { PageHeader, PageTitle } from "@/components/ui/shell/page";
import {
	Section,
	SectionContent,
	SectionDescription,
	SectionGrid,
	SectionHeader,
	SectionTitle,
} from "@/components/ui/shell/section";
import { Skeleton } from "@/components/ui/skeleton";
import { orpc } from "@/lib/orpc/orpc";
import { cn } from "@/lib/utils";

const RESOURCE_SUMMARY_PARAMS = {
	pageIndex: 0,
	pageSize: 1,
} as const;

const quickActions: Array<{
	title: string;
	description: string;
	icon: LucideIcon;
	linkProps: LinkProps;
	accent: string;
}> = [
	{
		title: "Create a new chatbot",
		description:
			"Create a configured AI experience for a course, team, or other use case.",
		icon: SparklesIcon,
		linkProps: {
			to: "/app/hub/bots/add",
		},
		accent: "text-primary",
	},
	{
		title: "Manage chatbots",
		description: "Open the bot library and iterate on ready-to-use setups.",
		icon: BotIcon,
		linkProps: {
			to: "/app/hub/bots",
		},
		accent: "text-purple-500",
	},
	{
		title: "Manage user access",
		description: "Manage cohorts and decide who can use a resource.",
		icon: UsersIcon,
		linkProps: {
			to: "/app/groups",
		},
		accent: "text-sky-500",
	},
	{
		title: "Manage AI behaviour",
		description:
			"Review reusable behaviour blocks that shape how bots respond.",
		icon: BlocksIcon,
		linkProps: {
			to: "/app/hub/behaviour",
		},
		accent: "text-green-500",
	},
	{
		title: "Curate content library",
		description:
			"Organise reusable source material for retrieval and citations.",
		icon: FolderOpenIcon,
		linkProps: {
			to: "/app/hub/assets",
		},
		accent: "text-orange-500",
	},
	{
		title: "Manage repositories",
		description:
			"Manage retrieval databases that ground bot answers in your content.",
		icon: DatabaseIcon,
		linkProps: {
			to: "/app/hub/repositories",
		},
		accent: "text-sky-500",
	},
];

const QuickActionsSection = () => (
	<Section>
		<SectionHeader>
			<SectionTitle>Quick Links</SectionTitle>
		</SectionHeader>
		<SectionContent>
			<SectionGrid layout="2">
				{quickActions.map((action) => (
					<Item
						key={action.title}
						variant="outline"
						className="bg-card"
						render={
							<Link key={action.title} {...action.linkProps}>
								<div className="flex flex-row gap-2">
									<ItemMedia
										variant="icon"
										className={cn(
											"size-10 rounded-lg bg-muted/50",
											action.accent,
										)}
									>
										<action.icon className="size-6" />
									</ItemMedia>
									<ItemContent>
										<ItemTitle>{action.title}</ItemTitle>
										<ItemDescription className="line-clamp-3 text-xs">
											{action.description}
										</ItemDescription>
									</ItemContent>
								</div>
							</Link>
						}
					/>
				))}
			</SectionGrid>
		</SectionContent>
	</Section>
);

// ----------------------------------------------------------------------------
// Workspace snapshot
// ----------------------------------------------------------------------------

const resourceHighlights: Array<{
	label: string;
	linkProps: LinkProps;
	icon: LucideIcon;
	accentBg: string;
	accentColor: string;
}> = [
	{
		label: "Bots",
		linkProps: {
			to: "/app/hub/bots",
		},
		icon: BotIcon,
		accentBg: "bg-purple-500/10",
		accentColor: "text-purple-500",
	},
	{
		label: "Behaviours",
		linkProps: {
			to: "/app/hub/behaviour",
		},
		icon: BlocksIcon,
		accentBg: "bg-green-500/10",
		accentColor: "text-green-500",
	},
	{
		label: "Repositories",
		linkProps: {
			to: "/app/hub/repositories",
		},
		icon: DatabaseIcon,
		accentBg: "bg-sky-500/10",
		accentColor: "text-sky-500",
	},
	{
		label: "Content",
		linkProps: {
			to: "/app/hub/assets",
		},
		icon: FileTextIcon,
		accentBg: "bg-orange-500/10",
		accentColor: "text-orange-500",
	},
];

const ResourceHighlights = () => {
	const { data: botSummary } = useSuspenseQuery(
		orpc.bot.list.queryOptions({
			input: RESOURCE_SUMMARY_PARAMS,
		}),
	);
	const { data: templateSummary } = useSuspenseQuery(
		orpc.block.list.queryOptions({
			input: {
				...RESOURCE_SUMMARY_PARAMS,
				filters: {
					type: "template",
				},
			},
		}),
	);
	const { data: imageGenerationSummary } = useSuspenseQuery(
		orpc.block.list.queryOptions({
			input: {
				...RESOURCE_SUMMARY_PARAMS,
				filters: {
					type: "imageGeneration",
				},
			},
		}),
	);
	const { data: repositorySummary } = useSuspenseQuery(
		orpc.block.list.queryOptions({
			input: {
				...RESOURCE_SUMMARY_PARAMS,
				filters: {
					type: "database",
				},
			},
		}),
	);
	const { data: assetSummary } = useSuspenseQuery(
		orpc.asset.list.queryOptions({
			input: RESOURCE_SUMMARY_PARAMS,
		}),
	);

	const counts = [
		botSummary.rowCount,
		templateSummary.rowCount + imageGenerationSummary.rowCount,
		repositorySummary.rowCount,
		assetSummary.rowCount,
	];

	return (
		<Section>
			<SectionHeader>
				<SectionDescription>
					A quick glance at the reusable pieces that support your workspace.
				</SectionDescription>
				<SectionTitle>Your Workspace Snapshot</SectionTitle>
			</SectionHeader>
			<SectionContent>
				<SectionGrid layout="4">
					{resourceHighlights.map((resource, index) => (
						<Item
							key={resource.label}
							variant="outline"
							render={
								<Link {...resource.linkProps} className="bg-card">
									<ItemMedia variant="icon">
										<resource.icon
											className={cn("size-5", resource.accentColor)}
										/>
									</ItemMedia>
									<ItemContent>
										<ItemTitle>{resource.label}</ItemTitle>
									</ItemContent>
									<Badge variant="secondary" className="text-xs">
										{counts[index]}
									</Badge>
								</Link>
							}
						/>
					))}
				</SectionGrid>
			</SectionContent>
		</Section>
	);
};

const ResourceHighlightsSkeleton = () => (
	<section className="space-y-4">
		<div className="space-y-2">
			<Skeleton className="h-7 w-40" />
			<Skeleton className="h-4 w-64" />
		</div>
		<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
			<SkeletonsArray className="h-20 w-full" count={4} />
		</div>
	</section>
);

// ----------------------------------------------------------------------------
// Manager view
// ----------------------------------------------------------------------------

const ManagerHome = () => {
	return (
		<div className="space-y-12">
			<PageHeader>
				<PageTitle>Your Workspace</PageTitle>
			</PageHeader>

			<QuickActionsSection />

			<Suspense fallback={<ResourceHighlightsSkeleton />}>
				<ResourceHighlights />
			</Suspense>
		</div>
	);
};

export { ManagerHome };
