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
	PlusIcon,
	SparklesIcon,
} from "lucide-react";
import { Suspense } from "react";
import { UserWelcome } from "@/components/app/user-welcome";
import { BotCard } from "@/components/bot/bot-card";
import { ChatsList } from "@/components/chat/chats-list";
import { Placeholder } from "@/components/placeholders/placeholder";
import { SkeletonsArray } from "@/components/placeholders/skeletons-array";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
	ButtonGroup,
	ButtonGroupSeparator,
} from "@/components/ui/button-group";
import { Card, CardContent } from "@/components/ui/card";
import {
	Item,
	ItemActions,
	ItemContent,
	ItemDescription,
	ItemMedia,
	ItemTitle,
} from "@/components/ui/item";
import { Page, PageContent } from "@/components/ui/shell/page";
import {
	Section,
	SectionAction,
	SectionContent,
	SectionDescription,
	SectionGrid,
	SectionHeader,
	SectionTitle,
} from "@/components/ui/shell/section";
import { Skeleton } from "@/components/ui/skeleton";
import { useCreateChatMutation } from "@/hooks/mutations/use-chat-mutation";
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
		<Page>
			<PageContent className="space-y-12">
				<Suspense fallback={<HomeHeroSkeleton />}>
					<HomeHero />
				</Suspense>

				<Section>
					<SectionHeader>
						<SectionTitle>Your Recent Conversations</SectionTitle>
						<SectionDescription>
							Pick right back up where you left off.
						</SectionDescription>
						<SectionAction>
							<Link
								to={"/app/chat"}
								className={buttonVariants({ variant: "outline", size: "sm" })}
							>
								Show all
							</Link>
							<Link
								to="/app/chat/setup"
								className={buttonVariants({
									size: "icon-sm",
									variant: "outline",
								})}
							>
								<PlusIcon />
							</Link>
						</SectionAction>
					</SectionHeader>

					<SectionContent>
						<ChatsList limit={6} />
					</SectionContent>
				</Section>

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
			</PageContent>
		</Page>
	);
}

const HomeHero = () => {
	const { mutate: createChat } = useCreateChatMutation();
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
							onClick={() => createChat({ botId: latestBot?.id })}
						>
							<SparklesIcon className="h-4 w-4" />
							Start a new chat
						</Button>
						<ButtonGroup>
							<Link
								to="/app/chat/setup"
								data-slot="button"
								className={buttonVariants({ variant: "outline" })}
							>
								<MessagesSquareIcon className="h-4 w-4" />
								Advanced setup
							</Link>

							<Link
								to="/app/hub/bots"
								data-slot="button"
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
	const { mutate: createChat } = useCreateChatMutation();

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
							onClick={() => createChat({ botId })}
						>
							<SparklesIcon className="h-4 w-4" />
							Start chat
						</Button>
						<ButtonGroupSeparator />
						<Link
							to="/app/hub/bots/$botId"
							params={{ botId }}
							data-slot="button"
							className={buttonVariants({
								variant: "outline",
								size: "sm",
								className: "gap-2",
							})}
						>
							<ArrowRightIcon className="h-4 w-4" />
							View bot
						</Link>
					</ButtonGroup>
				) : (
					<Link
						to="/app/hub/bots/add"
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
	const { mutate: createChat } = useCreateChatMutation();
	const { data: bots } = useSuspenseQuery(
		orpc.bot.list.queryOptions({ input: HOME_BOT_LIST_PARAMS }),
	);

	return (
		<Section>
			<SectionHeader>
				<SectionTitle>Available bots</SectionTitle>
				<SectionDescription>
					Select an assistant and jump straight into a tailored conversation.
				</SectionDescription>
				<SectionAction>
					<Link
						to="/app/hub/bots"
						className={buttonVariants({
							variant: "outline",
							size: "sm",
							className: "w-full sm:w-auto",
						})}
					>
						Manage library
					</Link>
				</SectionAction>
			</SectionHeader>

			<SectionContent>
				{bots.data.length === 0 ? (
					<Placeholder
						title="No bots yet"
						description="Create a bot to see it showcased here."
						actions={[
							{
								key: "create_bot",
								label: "Create bot",
								icon: SparklesIcon,
								variant: "outline",
								linkProps: {
									to: "/app/hub/bots/add",
								},
							},
						]}
					/>
				) : (
					<SectionGrid layout="3">
						{bots.data.map((bot) => (
							<BotCard
								key={bot.id}
								bot={bot}
								actions={{
									footer: [
										{
											key: "start_chat",
											label: "Start chat",
											onClick: () => createChat({ botId: bot.id }),
											variant: "default",
										},
									],
								}}
							/>
						))}
					</SectionGrid>
				)}
			</SectionContent>
		</Section>
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
			linkProps: { to: "/app/hub/bots" },
			accent: "text-purple-500",
		},
		{
			title: "Manage blocks",
			description: "Compose reusable logic components.",
			icon: BlocksIcon,
			linkProps: { to: "/app/hub/blocks" },
			accent: "text-green-500",
		},
		{
			title: "Manage assets",
			description: "Curate knowledge sources for grounding.",
			icon: FolderOpenIcon,
			linkProps: { to: "/app/hub/assets" },
			accent: "text-orange-500",
		},
		{
			title: "Create bot",
			description: "Design a new tailored assistant.",
			icon: SparklesIcon,
			linkProps: { to: "/app/hub/bots/add" },
			accent: "text-primary",
		},
		{
			title: "Create block",
			description: "Add a new building block to your toolkit.",
			icon: BlocksIcon,
			linkProps: { to: "/app/hub/blocks/add" },
			accent: "text-primary",
		},
	];

	return (
		<Section>
			<SectionHeader>
				<SectionTitle>Quick actions</SectionTitle>
				<SectionDescription>
					Access key tools to keep momentum across your workspace.
				</SectionDescription>
			</SectionHeader>
			<SectionContent>
				<SectionGrid layout="3">
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
				</SectionGrid>
			</SectionContent>
		</Section>
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
			linkProps: { to: "/app/hub/bots" },
			icon: BotIcon,
			accentBg: "bg-purple-500/10",
			accentColor: "text-purple-500",
		},
		{
			label: "Blocks",
			count: blockSummary.rowCount,
			description: "Reusable logic powering your flows.",
			linkProps: { to: "/app/hub/blocks" },
			icon: BlocksIcon,
			accentBg: "bg-green-500/10",
			accentColor: "text-green-500",
		},
		{
			label: "Assets",
			count: assetSummary.rowCount,
			description: "Knowledge sources grounding chats.",
			linkProps: { to: "/app/hub/assets" },
			icon: FileTextIcon,
			accentBg: "bg-orange-500/10",
			accentColor: "text-orange-500",
		},
	] satisfies Array<{
		label: string;
		count: number;
		description: string;
		linkProps: LinkProps;
		icon: LucideIcon;
		accentBg: string;
		accentColor: string;
	}>;

	return (
		<Section>
			<SectionHeader>
				<SectionTitle>Resource highlights</SectionTitle>
				<SectionDescription>
					A quick glance at the building blocks that fuel your workspace.
				</SectionDescription>
			</SectionHeader>

			<SectionContent>
				<SectionGrid layout="3">
					{resources.map((resource) => (
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
										{resource.count}
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
