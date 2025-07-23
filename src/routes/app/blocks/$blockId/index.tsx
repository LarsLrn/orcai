import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { format } from "date-fns";
import {
	BotIcon,
	BuildingIcon,
	CalendarIcon,
	CopyIcon,
	EditIcon,
	GitForkIcon,
	MoreVerticalIcon,
	SettingsIcon,
	TagIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
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
import {
	HoverCard,
	HoverCardContent,
	HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Separator } from "@/components/ui/separator";
import { blockQueryOptions } from "@/lib/query-options/block";

export const Route = createFileRoute("/app/blocks/$blockId/")({
	component: RouteComponent,
});

function RouteComponent() {
	const { blockId } = Route.useParams();
	const { data: block } = useSuspenseQuery(
		blockQueryOptions.find({
			input: { id: blockId },
		}),
	);

	const {
		id,
		name,
		type,
		config,
		createdAt,
		updatedAt,
		version,
		forkedFromId,
	} = block.data;

	return (
		<div className="container mx-auto max-w-4xl space-y-8">
			{/* Header Section */}
			<div className="flex flex-col space-y-6">
				<div className="flex items-start justify-between">
					<div className="space-y-2">
						<div className="flex items-center gap-3">
							<h1 className="font-bold text-3xl tracking-tight md:text-4xl">
								{name}
							</h1>
							<Badge variant="outline" className="capitalize">
								<TagIcon className="mr-1 h-3 w-3" />
								{type}
							</Badge>
						</div>
						<p className="text-muted-foreground">
							Block ID:{" "}
							<code className="rounded bg-muted px-1 py-0.5 text-xs">{id}</code>
						</p>
					</div>
					<div className="flex gap-2">
						<Link
							to={"/app/blocks/$blockId/edit"}
							params={{ blockId: id }}
							className={buttonVariants({ variant: "default" })}
						>
							<EditIcon className="mr-2 h-4 w-4" />
							Edit Block
						</Link>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="outline" size="icon">
									<MoreVerticalIcon className="h-4 w-4" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuItem>
									<CopyIcon className="mr-2 h-4 w-4" />
									Duplicate Block
								</DropdownMenuItem>
								<DropdownMenuItem>
									<GitForkIcon className="mr-2 h-4 w-4" />
									Fork Block
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem>
									<SettingsIcon className="mr-2 h-4 w-4" />
									Advanced Settings
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</div>

				{/* Metadata Badges */}
				<div className="flex flex-wrap gap-2">
					<Badge variant="secondary">
						<CalendarIcon className="mr-1 h-3 w-3" />
						Created {format(createdAt ?? "", "MMM dd, yyyy")}
					</Badge>
					{updatedAt && (
						<Badge variant="outline">
							Updated {format(updatedAt, "MMM dd, yyyy 'at' HH:mm")}
						</Badge>
					)}
					<Badge variant="outline">Version {version}</Badge>
					{forkedFromId && (
						<HoverCard>
							<HoverCardTrigger asChild>
								<Badge variant="outline" className="cursor-help">
									<GitForkIcon className="mr-1 h-3 w-3" />
									Forked
								</Badge>
							</HoverCardTrigger>
							<HoverCardContent>
								<p className="text-sm">
									This block was forked from another block.
								</p>
								<code className="mt-1 block rounded bg-muted px-1 py-0.5 text-xs">
									{forkedFromId}
								</code>
							</HoverCardContent>
						</HoverCard>
					)}
				</div>
			</div>

			<Separator />

			{/* Configuration Card */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<BotIcon className="h-5 w-5" />
						AI Configuration
					</CardTitle>
					<CardDescription>
						Configure the AI model and settings for this block
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-6">
					<div className="grid grid-cols-1 gap-6 md:grid-cols-2">
						<div className="space-y-2">
							<div className="font-medium text-sm">Provider</div>
							<div className="flex items-center gap-2">
								<BuildingIcon className="h-4 w-4 text-muted-foreground" />
								<Badge variant="secondary" className="capitalize">
									{config.provider}
								</Badge>
							</div>
						</div>
						<div className="space-y-2">
							<div className="font-medium text-sm">Model</div>
							<div className="flex items-center gap-2">
								<BotIcon className="h-4 w-4 text-muted-foreground" />
								<Badge variant="default">{config.model}</Badge>
							</div>
						</div>
					</div>

					{config.systemPrompt && (
						<div className="space-y-2">
							<div className="font-medium text-sm">System Prompt</div>
							<div className="rounded-md border bg-muted/50 p-4">
								<pre className="whitespace-pre-wrap text-muted-foreground text-sm">
									{config.systemPrompt}
								</pre>
							</div>
						</div>
					)}
				</CardContent>
			</Card>

			{/* Usage Statistics Card (Placeholder) */}
			<Card>
				<CardHeader>
					<CardTitle>Usage Statistics</CardTitle>
					<CardDescription>
						Track how this block is being used across your chats
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="grid grid-cols-1 gap-6 md:grid-cols-3">
						<div className="space-y-2 text-center">
							<div className="font-bold text-2xl text-primary">0</div>
							<p className="text-muted-foreground text-sm">Times Used</p>
						</div>
						<div className="space-y-2 text-center">
							<div className="font-bold text-2xl text-primary">0</div>
							<p className="text-muted-foreground text-sm">Active Chats</p>
						</div>
						<div className="space-y-2 text-center">
							<div className="font-bold text-2xl text-primary">0</div>
							<p className="text-muted-foreground text-sm">Forks</p>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Actions */}
			<div className="flex justify-between">
				<Button variant="outline" asChild>
					<Link to="/app/blocks">← Back to Blocks</Link>
				</Button>
				<div className="flex gap-2">
					<Button variant="outline">Export Block</Button>
					<Button variant="outline">Share Block</Button>
				</div>
			</div>
		</div>
	);
}
