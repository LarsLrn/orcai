import { useSuspenseQuery } from "@tanstack/react-query";
import type { LinkProps } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import {
	ArrowRightIcon,
	BlocksIcon,
	BotIcon,
	FileTextIcon,
	FolderOpenIcon,
	type LucideIcon,
	MessageSquarePlusIcon,
	SparklesIcon,
	UsersIcon,
} from "lucide-react";
import { Suspense } from "react";
import { SkeletonsArray } from "@/components/placeholders/skeletons-array";
import { Badge } from "@/components/ui/badge";
import {
	Item,
	ItemActions,
	ItemContent,
	ItemDescription,
	ItemMedia,
	ItemTitle,
} from "@/components/ui/item";
import {
	PageDescription,
	PageHeader,
	PageTitle,
} from "@/components/ui/shell/page";
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

// ----------------------------------------------------------------------------
// Task entry points
// ----------------------------------------------------------------------------

const quickActions: Array<{
	title: string;
	description: string;
	icon: LucideIcon;
	linkProps: LinkProps;
	accent: string;
}> = [
	{
		title: "Start a chat",
		description: "Open a new chat with or without a bot.",
		icon: MessageSquarePlusIcon,
		linkProps: {
			to: "/app/chat/setup",
		},
		accent: "text-primary",
	},
	{
		title: "Develop a bot",
		description:
			"Create a configured AI experience for a course, team, or other use case.",
		icon: SparklesIcon,
		linkProps: {
			to: "/app/hub/bots/add",
		},
		accent: "text-primary",
	},
	{
		title: "Grant a group access",
		description: "Manage cohorts and decide who can use a resource.",
		icon: UsersIcon,
		linkProps: {
			to: "/app/groups",
		},
		accent: "text-sky-500",
	},
	{
		title: "Review bots",
		description: "Open the bot library and iterate on published setups.",
		icon: BotIcon,
		linkProps: {
			to: "/app/hub/bots",
		},
		accent: "text-purple-500",
	},
	{
		title: "Manage blocks",
		description: "Review reusable behavior and retrieval building blocks.",
		icon: BlocksIcon,
		linkProps: {
			to: "/app/hub/blocks",
		},
		accent: "text-green-500",
	},
	{
		title: "Curate content library",
		description:
			"Organize reusable source material for retrieval and citations.",
		icon: FolderOpenIcon,
		linkProps: {
			to: "/app/hub/assets",
		},
		accent: "text-orange-500",
	},
	{
		title: "Create a block",
		description:
			"Add reusable behavior, retrieval, or image-generation building blocks.",
		icon: BlocksIcon,
		linkProps: {
			to: "/app/hub/blocks/add",
		},
		accent: "text-primary",
	},
];

const QuickActionsSection = () => (
	<Section>
		<SectionHeader>
			<SectionTitle>Task entry points</SectionTitle>
			<SectionDescription>
				Pick the kind of work you want to do next.
			</SectionDescription>
		</SectionHeader>
		<SectionContent>
			<SectionGrid layout="3">
				{quickActions.map((action) => (
					<Item
						key={action.title}
						variant="outline"
						className="bg-card"
						render={
							<Link key={action.title} {...action.linkProps}>
								<ItemMedia
									variant="icon"
									className={cn("size-12", action.accent)}
								>
									<action.icon className="size-6" />
								</ItemMedia>
								<ItemContent>
									<ItemTitle>{action.title}</ItemTitle>
									<ItemDescription>{action.description}</ItemDescription>
								</ItemContent>
								<ItemActions>
									Go now
									<ArrowRightIcon className="size-4" />
								</ItemActions>
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
	description: string;
	linkProps: LinkProps;
	icon: LucideIcon;
	accentBg: string;
	accentColor: string;
}> = [
	{
		label: "Bots",
		description: "Configured AI experiences ready to use.",
		linkProps: {
			to: "/app/hub/bots",
		},
		icon: BotIcon,
		accentBg: "bg-purple-500/10",
		accentColor: "text-purple-500",
	},
	{
		label: "Blocks",
		description: "Reusable behavior and retrieval building blocks.",
		linkProps: {
			to: "/app/hub/blocks",
		},
		icon: BlocksIcon,
		accentBg: "bg-green-500/10",
		accentColor: "text-green-500",
	},
	{
		label: "Content",
		description: "Reusable source material grounding answers.",
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
	const { data: blockSummary } = useSuspenseQuery(
		orpc.block.list.queryOptions({
			input: RESOURCE_SUMMARY_PARAMS,
		}),
	);
	const { data: assetSummary } = useSuspenseQuery(
		orpc.asset.list.queryOptions({
			input: RESOURCE_SUMMARY_PARAMS,
		}),
	);

	const counts = [
		botSummary.rowCount,
		blockSummary.rowCount,
		assetSummary.rowCount,
	];

	return (
		<Section>
			<SectionHeader>
				<SectionTitle>Workspace snapshot</SectionTitle>
				<SectionDescription>
					A quick glance at the reusable pieces that support your workspace.
				</SectionDescription>
			</SectionHeader>
			<SectionContent>
				<SectionGrid layout="3">
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
										<ItemDescription className="text-xs">
											{resource.description}
										</ItemDescription>
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
		<div className="grid gap-4 sm:grid-cols-3">
			<SkeletonsArray className="h-20 w-full" count={3} />
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
				<PageTitle>Workspace</PageTitle>
				<PageDescription>
					Manage bots, blocks, content, groups, and other platform resources.
				</PageDescription>
			</PageHeader>

			<QuickActionsSection />

			<Suspense fallback={<ResourceHighlightsSkeleton />}>
				<ResourceHighlights />
			</Suspense>
		</div>
	);
};

export { ManagerHome };
