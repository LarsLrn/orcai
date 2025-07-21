import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import {
	BotIcon,
	BotMessageSquareIcon,
	Calendar,
	Clock,
	Code2Icon,
	CopyIcon,
	EditIcon,
	GitForkIcon,
	MoreVerticalIcon,
	TagIcon,
	Trash2Icon,
	UserIcon,
} from "lucide-react";
import { NewChatButton } from "@/components/chat/new-chat-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { orpc } from "@/lib/orpc/orpc";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/(bots)/bots/$botId")({
	component: RouteComponent,
	loader: async ({ context: { queryClient }, params: { botId } }) => {
		await queryClient.ensureQueryData(
			orpc.bot.find.queryOptions({
				input: { id: botId },
				queryKey: orpc.bot.find.key({
					input: { id: botId },
				}),
			}),
		);
	},
});

function RouteComponent() {
	const { botId } = Route.useParams();

	const { data: botData } = useSuspenseQuery(
		orpc.bot.find.queryOptions({
			input: { id: botId },
			queryKey: orpc.bot.find.key({
				input: { id: botId },
			}),
		}),
	);

	const bot = botData.data;

	const formatDate = (date: Date | string) => {
		const dateObj = typeof date === "string" ? new Date(date) : date;
		return format(dateObj, "PPP 'at' p");
	};

	const getBlockTypeColor = (type: string): string => {
		const typeColors: Record<string, string> = {
			prompt: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
			context:
				"bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
			memory:
				"bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
			tool: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
			output: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
		};
		return (
			typeColors[type] ||
			"bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
		);
	};

	return (
		<div className="container mx-auto space-y-6 p-6">
			{/* Header Section */}
			<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
				<div className="space-y-2">
					<div className="flex items-center gap-3">
						<div className="flex size-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
							<BotIcon className="size-6" />
						</div>
						<div>
							<h1 className="font-bold text-2xl tracking-tight">{bot.name}</h1>
							<p className="text-muted-foreground text-sm">
								Version {bot.version} • Bot ID: {bot.id.slice(0, 8)}...
							</p>
						</div>
					</div>
					{bot.description && (
						<p className="max-w-2xl text-muted-foreground">{bot.description}</p>
					)}
				</div>

				<div className="flex items-center gap-2">
					<Button variant="outline" className="gap-2">
						<CopyIcon className="size-4" />
						Clone
					</Button>
					<Button className="gap-2">
						<EditIcon className="size-4" />
						Edit Bot
					</Button>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" size="icon">
								<MoreVerticalIcon className="size-4" />
								<span className="sr-only">More options</span>
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem>
								<GitForkIcon className="mr-2 size-4" />
								Fork Bot
							</DropdownMenuItem>
							<DropdownMenuItem>
								<Code2Icon className="mr-2 size-4" />
								Export Config
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem className="text-destructive">
								<Trash2Icon className="mr-2 size-4" />
								Delete Bot
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>

			<div className="grid gap-6 lg:grid-cols-3">
				{/* Main Content */}
				<div className="space-y-6 lg:col-span-2">
					{/* Bot Configuration */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Code2Icon className="size-5" />
								Configuration
							</CardTitle>
							<CardDescription>
								Bot configuration and content settings
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							{/* HTML Content Preview */}
							{bot.contentHtml && (
								<div>
									<div className="font-medium text-sm">Content Preview</div>
									<div className="mt-2 max-h-32 overflow-y-auto rounded-md border bg-muted/50 p-3 text-sm">
										<div className="prose prose-sm max-w-none">
											{bot.contentHtml.slice(0, 300) +
												(bot.contentHtml.length > 300 ? "..." : "")}
										</div>
									</div>
								</div>
							)}

							{/* JSON Configuration */}
							{bot.contentJson && typeof bot.contentJson === "object" && (
								<div>
									<div className="font-medium text-sm">JSON Configuration</div>
									<div className="mt-2 max-h-40 overflow-y-auto rounded-md border bg-muted/50 p-3">
										<pre className="font-mono text-xs">
											{JSON.stringify(bot.contentJson, null, 2)}
										</pre>
									</div>
								</div>
							)}
						</CardContent>
					</Card>

					{/* Associated Blocks */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<TagIcon className="size-5" />
								Associated Blocks
								<Badge variant="secondary" className="ml-auto">
									{bot.blocks?.length || 0}
								</Badge>
							</CardTitle>
							<CardDescription>
								Blocks that make up this bot's functionality
							</CardDescription>
						</CardHeader>
						<CardContent>
							{bot.blocks && bot.blocks.length > 0 ? (
								<div className="grid gap-3 sm:grid-cols-2">
									{bot.blocks.map((block) => (
										<Card key={block.id} className="border-border/50">
											<CardHeader className="pb-2">
												<div className="flex items-start justify-between">
													<div className="space-y-1">
														<CardTitle className="text-base">
															{block.name}
														</CardTitle>
														<Badge
															className={cn(
																"text-xs",
																getBlockTypeColor(block.type),
															)}
														>
															{block.type}
														</Badge>
													</div>
													<Tooltip>
														<TooltipTrigger asChild>
															<div className="text-muted-foreground text-xs">
																v{block.version}
															</div>
														</TooltipTrigger>
														<TooltipContent>
															<p>Block version {block.version}</p>
														</TooltipContent>
													</Tooltip>
												</div>
											</CardHeader>
											<CardContent className="pt-0">
												<div className="flex items-center justify-between text-muted-foreground text-xs">
													<span>
														Created{" "}
														{format(
															block.createdAt || new Date(),
															"MMM d, yyyy",
														)}
													</span>
													<Button
														variant="ghost"
														size="sm"
														className="h-6 px-2"
													>
														View
													</Button>
												</div>
											</CardContent>
										</Card>
									))}
								</div>
							) : (
								<div className="flex flex-col items-center justify-center py-8 text-center">
									<TagIcon className="mb-2 size-8 text-muted-foreground" />
									<p className="text-muted-foreground">No blocks associated</p>
									<p className="text-muted-foreground text-sm">
										Add blocks to enhance this bot's capabilities
									</p>
								</div>
							)}
						</CardContent>
					</Card>
				</div>

				{/* Sidebar */}
				<div className="space-y-6">
					{/* Bot Metadata */}
					<Card>
						<CardHeader>
							<CardTitle className="text-base">Bot Details</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="space-y-3 text-sm">
								<div className="flex items-center gap-2">
									<Calendar className="size-4 text-muted-foreground" />
									<span className="text-muted-foreground">Created:</span>
									<span className="font-medium">
										{formatDate(bot.createdAt || new Date())}
									</span>
								</div>
								<div className="flex items-center gap-2">
									<Clock className="size-4 text-muted-foreground" />
									<span className="text-muted-foreground">Updated:</span>
									<span className="font-medium">
										{formatDate(bot.updatedAt || new Date())}
									</span>
								</div>
								<div className="flex items-center gap-2">
									<UserIcon className="size-4 text-muted-foreground" />
									<span className="text-muted-foreground">Owner:</span>
									<span className="font-medium">
										{bot.userId.slice(0, 8)}...
									</span>
								</div>
								{bot.forkedFromId && (
									<div className="flex items-center gap-2">
										<GitForkIcon className="size-4 text-muted-foreground" />
										<span className="text-muted-foreground">Forked from:</span>
										<span className="font-medium">
											{bot.forkedFromId.slice(0, 8)}...
										</span>
									</div>
								)}
							</div>
						</CardContent>
					</Card>

					{/* Quick Actions */}
					<Card>
						<CardHeader>
							<CardTitle className="text-base">Quick Actions</CardTitle>
						</CardHeader>
						<CardContent className="space-y-2">
							<NewChatButton
								variant="outline"
								botId={bot.id}
								className="w-full justify-start gap-2"
							>
								<BotMessageSquareIcon className="size-4" />
								Start Chat
							</NewChatButton>
							<Button variant="outline" className="w-full justify-start gap-2">
								<CopyIcon className="size-4" />
								Duplicate
							</Button>
							<Button variant="outline" className="w-full justify-start gap-2">
								<GitForkIcon className="size-4" />
								Create Fork
							</Button>
							<Separator className="my-3" />
							<Button
								variant="outline"
								className="w-full justify-start gap-2 text-destructive hover:bg-destructive hover:text-destructive-foreground"
							>
								<Trash2Icon className="size-4" />
								Delete Bot
							</Button>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}
