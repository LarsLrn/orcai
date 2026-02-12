import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, type LinkProps } from "@tanstack/react-router";
import {
	ArrowRightIcon,
	BlocksIcon,
	BotIcon,
	FileTextIcon,
	FolderOpenIcon,
	type LucideIcon,
	MessageSquarePlusIcon,
	MessagesSquareIcon,
	SparklesIcon,
} from "lucide-react";
import { Suspense } from "react";
import { UserWelcome } from "@/components/app/user-welcome";
import { BotPreview } from "@/components/bot/bot-preview";
import { ChatsPreview } from "@/components/chat/chats-preview";
import { SkeletonsArray } from "@/components/placeholders/skeletons-array";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
	ButtonGroup,
	ButtonGroupSeparator,
} from "@/components/ui/button-group";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardTitle,
} from "@/components/ui/card";
import {
	Empty,
	EmptyContent,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import {
	Item,
	ItemActions,
	ItemContent,
	ItemDescription,
	ItemMedia,
	ItemTitle,
} from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";
import { useCreateChat } from "@/hooks/actions/use-create-chat";
import { orpc } from "@/lib/orpc/orpc";
import { cn } from "@/lib/utils";

const HOME_BOT_LIST_PARAMS = { pageIndex: 0, pageSize: 6 } as const;
const RESOURCE_SUMMARY_PARAMS = { pageIndex: 0, pageSize: 1 } as const;

export const Route = createFileRoute("/app/")({
	loader: async ({ context: { queryClient } }) => {
		await Promise.all([
			queryClient.ensureQueryData(
				orpc.bot.list.queryOptions({ input: HOME_BOT_LIST_PARAMS }),
			),
			queryClient.ensureQueryData(
				orpc.block.list.queryOptions({ input: RESOURCE_SUMMARY_PARAMS }),
			),
			queryClient.ensureQueryData(
				orpc.asset.list.queryOptions({ input: RESOURCE_SUMMARY_PARAMS }),
			),
		]);
	},
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<div className="space-y-12">
			<Suspense fallback={<HomeHeroSkeleton />}>
				<HomeHero />
			</Suspense>

			<Suspense fallback={<ChatsSectionSkeleton />}>
				<ChatsPreview />
			</Suspense>

			<div className="grid gap-8 xl:grid-cols-[3fr,2fr]">
				<div className="space-y-8">
					<Suspense fallback={<BotsShowcaseSkeleton />}>
						<BotsShowcase />
					</Suspense>

					<QuickActions />
				</div>

				<div className="space-y-8">
					<Suspense fallback={<ResourceHighlightsSkeleton />}>
						<ResourceHighlights />
					</Suspense>
				</div>
			</div>
		</div>
	);
}

const HomeHero = () => {
	const { createChat } = useCreateChat();
	const { data: bots } = useSuspenseQuery(
		orpc.bot.list.queryOptions({ input: HOME_BOT_LIST_PARAMS }),
	);
	const latestBot = bots.data.at(0);

	return (
		<Card className="relative overflow-hidden border bg-card shadow-xl">
			<div className="pointer-events-none absolute inset-0 bg-linear-to-br from-primary/20 via-accent/20 to-transparent" />
			<CardContent className="relative flex flex-col gap-10 p-10 lg:flex-row lg:items-start lg:justify-between">
				<div className="space-y-6 text-card-foreground">
					<UserWelcome />
					<div className="flex flex-wrap items-center gap-2">
						<Button
							className="gap-2 px-6"
							onClick={() => createChat(latestBot?.id)}
						>
							<SparklesIcon className="h-4 w-4" />
							Start a new chat
						</Button>
						<ButtonGroup>
							<Link
								to="/app/chat/setup"
								className={buttonVariants({ variant: "outline" })}
							>
								<MessagesSquareIcon className="h-4 w-4" />
								Advanced setup
							</Link>

							<Link
								to="/app/bots"
								className={buttonVariants({ variant: "outline" })}
							>
								<BotIcon className="h-4 w-4" />
								Browse bots
							</Link>
						</ButtonGroup>
					</div>
				</div>

				<div className="grid w-full max-w-xs gap-4 sm:grid-cols-1">
					<HeroLatestBotCard botName={latestBot?.name} botId={latestBot?.id} />
				</div>
			</CardContent>
		</Card>
	);
};

const HeroLatestBotCard = ({
	botName,
	botId,
}: {
	botName?: string;
	botId?: string;
}) => {
	const { createChat } = useCreateChat();

	return (
		<Item className="items-start justify-between bg-card" variant="outline">
			<ItemContent>
				<p className="font-medium text-primary text-sm">Quick start</p>
				<ItemTitle className="font-bold text-card-foreground text-xl">
					{botName ?? "No bots yet"}
				</ItemTitle>
				<ItemDescription>
					{botName
						? "Spin up a conversation with your latest assistant."
						: "Build a bot to unlock personalised conversations."}
				</ItemDescription>
			</ItemContent>
			<div className="mt-4 flex gap-2 self-end">
				{botId ? (
					<ButtonGroup>
						<Button
							size="sm"
							className="gap-2"
							onClick={() => createChat(botId)}
						>
							<SparklesIcon className="h-4 w-4" />
							Start chat
						</Button>
						<ButtonGroupSeparator />
						<Button variant="outline" size="sm">
							<Link to="/app/bots/$botId" params={{ botId }}>
								<ArrowRightIcon className="h-4 w-4" />
								View bot
							</Link>
						</Button>
					</ButtonGroup>
				) : (
					<Link
						to="/app/bots/add"
						className={buttonVariants({
							variant: "secondary",
							size: "sm",
							className: "gap-2",
						})}
					>
						<SparklesIcon className="h-4 w-4" />
						Create bot
					</Link>
				)}
			</div>
		</Item>
	);
};

const BotsShowcase = () => {
	const { createChat } = useCreateChat();
	const { data: bots } = useSuspenseQuery(
		orpc.bot.list.queryOptions({ input: HOME_BOT_LIST_PARAMS }),
	);

	return (
		<section className="space-y-4">
			<div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<CardTitle className="text-xl">Available bots</CardTitle>
					<CardDescription>
						Select an assistant and jump straight into a tailored conversation.
					</CardDescription>
				</div>

				<Link
					to="/app/bots"
					className={buttonVariants({
						variant: "outline",
						size: "sm",
						className: "w-full sm:w-auto",
					})}
				>
					Manage library
				</Link>
			</div>

			{bots.data.length === 0 ? (
				<Empty className="border border-dashed">
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<BotIcon />
						</EmptyMedia>
						<EmptyTitle>No bots yet</EmptyTitle>
					</EmptyHeader>
					<EmptyContent>
						<Link
							to="/app/bots/add"
							className={buttonVariants({ variant: "outline", size: "sm" })}
						>
							<SparklesIcon className="mr-2 h-4 w-4" />
							Create a bot
						</Link>
					</EmptyContent>
				</Empty>
			) : (
				<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
					{bots.data.map((bot) => (
						<BotPreview key={bot.id} bot={bot}>
							<CardFooter className="gap-2 pt-4">
								<ButtonGroup className="w-full">
									<Button
										onClick={() => createChat(bot.id)}
										size="sm"
										className="flex-1 gap-2"
									>
										<SparklesIcon className="h-4 w-4" />
										Start chat
									</Button>
									<ButtonGroupSeparator />

									<Button size="sm" className="flex-1" variant="outline">
										<Link to="/app/bots/$botId" params={{ botId: bot.id }}>
											View details
										</Link>
									</Button>
								</ButtonGroup>
							</CardFooter>
						</BotPreview>
					))}
				</div>
			)}
		</section>
	);
};

const QuickActions = () => {
	const actions: Array<{
		title: string;
		description: string;
		icon: LucideIcon;
		linkProps: LinkProps;
		accent: string;
	}> = [
		{
			title: "New chat",
			description: "Start a guided conversation from scratch.",
			icon: MessageSquarePlusIcon,
			linkProps: { to: "/app/chat/setup" },
			accent: "text-primary",
		},
		{
			title: "Manage bots",
			description: "Review and iterate on your assistants.",
			icon: BotIcon,
			linkProps: { to: "/app/bots" },
			accent: "text-purple-500",
		},
		{
			title: "Manage blocks",
			description: "Compose reusable logic components.",
			icon: BlocksIcon,
			linkProps: { to: "/app/blocks" },
			accent: "text-green-500",
		},
		{
			title: "Manage assets",
			description: "Curate knowledge sources for grounding.",
			icon: FolderOpenIcon,
			linkProps: { to: "/app/assets" },
			accent: "text-orange-500",
		},
		{
			title: "Create bot",
			description: "Design a new tailored assistant.",
			icon: SparklesIcon,
			linkProps: { to: "/app/bots/add" },
			accent: "text-primary",
		},
		{
			title: "Create block",
			description: "Add a new building block to your toolkit.",
			icon: BlocksIcon,
			linkProps: { to: "/app/blocks/add" },
			accent: "text-primary",
		},
	];

	return (
		<div className="space-y-4">
			<div>
				<CardTitle className="text-xl">Quick actions</CardTitle>
				<CardDescription>
					Access key tools to keep momentum across your workspace.
				</CardDescription>
			</div>
			<div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
				{actions.map((action) => (
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
			</div>
		</div>
	);
};

const ResourceHighlights = () => {
	const { data: botSummary } = useSuspenseQuery(
		orpc.bot.list.queryOptions({ input: RESOURCE_SUMMARY_PARAMS }),
	);
	const { data: blockSummary } = useSuspenseQuery(
		orpc.block.list.queryOptions({ input: RESOURCE_SUMMARY_PARAMS }),
	);
	const { data: assetSummary } = useSuspenseQuery(
		orpc.asset.list.queryOptions({ input: RESOURCE_SUMMARY_PARAMS }),
	);

	const resources = [
		{
			label: "Bots",
			count: botSummary.rowCount,
			description: "Custom assistants ready to deploy.",
			href: "/app/bots",
			icon: BotIcon,
			accentBg: "bg-purple-500/10",
			accentColor: "text-purple-500",
		},
		{
			label: "Blocks",
			count: blockSummary.rowCount,
			description: "Reusable logic powering your flows.",
			href: "/app/blocks",
			icon: BlocksIcon,
			accentBg: "bg-green-500/10",
			accentColor: "text-green-500",
		},
		{
			label: "Assets",
			count: assetSummary.rowCount,
			description: "Knowledge sources grounding chats.",
			href: "/app/assets",
			icon: FileTextIcon,
			accentBg: "bg-orange-500/10",
			accentColor: "text-orange-500",
		},
	] as const;

	return (
		<div className="space-y-4 border-border/70">
			<div>
				<CardTitle className="text-xl">Resource highlights</CardTitle>
				<CardDescription>
					A quick glance at the building blocks that fuel your workspace.
				</CardDescription>
			</div>
			<div className="grid gap-4 md:grid-cols-3">
				{resources.map((resource) => (
					<Item
						key={resource.label}
						variant="outline"
						render={
							<Link to={resource.href} className="bg-card">
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
									{resource.count}
								</Badge>
							</Link>
						}
					/>
				))}
			</div>
		</div>
	);
};

const HomeHeroSkeleton = () => (
	<Card className="relative overflow-hidden border border-primary/20">
		<CardContent className="space-y-6 p-10">
			<Skeleton className="h-10 w-1/3" />
			<Skeleton className="h-4 w-1/2" />
			<div className="flex gap-3">
				<Skeleton className="h-11 w-36" />
				<Skeleton className="h-11 w-36" />
				<Skeleton className="h-11 w-36" />
			</div>
			<div className="grid gap-4 sm:grid-cols-2">
				<Skeleton className="h-32 w-full" />
				<Skeleton className="h-32 w-full" />
			</div>
		</CardContent>
	</Card>
);

const BotsShowcaseSkeleton = () => (
	<section className="space-y-4">
		<div className="space-y-2">
			<Skeleton className="h-7 w-40" />
			<Skeleton className="h-4 w-64" />
		</div>
		<Skeleton className="h-9 w-32" />
		<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
			<SkeletonsArray className="h-48 w-full" count={3} />
		</div>
	</section>
);

const ResourceHighlightsSkeleton = () => (
	<Card>
		<CardContent className="space-y-3 p-6">
			<SkeletonsArray className="h-20 w-full" count={3} />
		</CardContent>
	</Card>
);

const ChatsSectionSkeleton = () => (
	<section className="space-y-4">
		<Skeleton className="h-7 w-40" />
		<Skeleton className="h-80 w-full rounded-2xl" />
	</section>
);
