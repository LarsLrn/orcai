import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { format } from "date-fns";
import {
	CalendarIcon,
	CopyIcon,
	EditIcon,
	GitForkIcon,
	GlobeIcon,
	KeyRoundIcon,
	MoreVerticalIcon,
	SettingsIcon,
	TagIcon,
} from "lucide-react";
import { useState } from "react";
import { AccessDialog } from "@/components/access/access-dialog";
import { Page, PageContent, PageHeader } from "@/components/app/page";
import { DatabaseBlockConfigCard } from "@/components/blocks/database-block/database-config";
import { TemplateBlockConfigCard } from "@/components/blocks/template-block/template-config";
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
import { orpc } from "@/lib/orpc/orpc";

export const Route = createFileRoute("/app/blocks/$blockId/")({
	component: RouteComponent,
});

function RouteComponent() {
	const { blockId } = Route.useParams();
	const [isAccessOpen, setIsAccessOpen] = useState(false);
	const { data: block } = useSuspenseQuery(
		orpc.block.find.queryOptions({
			input: { id: blockId },
		}),
	);
	const { data: visibility } = useSuspenseQuery(
		orpc.resource.getVisibility.queryOptions({
			input: { resourceType: "block", resourceId: blockId },
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
		<Page>
			{/* Header Section */}
			<PageHeader>
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
							<code className="rounded border bg-muted/30 px-1 py-0.5 text-xs">
								{id}
							</code>
						</p>
					</div>
					<div className="flex gap-2">
						<Button
							variant="outline"
							onClick={() => setIsAccessOpen(true)}
							className="gap-2"
						>
							<KeyRoundIcon className="h-4 w-4" />
							Access
						</Button>
						<Link
							to={"/app/blocks/$blockId/edit"}
							params={{ blockId: id }}
							className={buttonVariants({ variant: "default" })}
						>
							<EditIcon className="mr-2 h-4 w-4" />
							Edit Block
						</Link>
						<DropdownMenu>
							<DropdownMenuTrigger
								render={
									<Button variant="outline" size="icon">
										<MoreVerticalIcon className="h-4 w-4" />
									</Button>
								}
							/>
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
					{visibility.data.visibility === "public" && (
						<Badge variant="default">
							<GlobeIcon className="mr-1 h-3 w-3" />
							Public
						</Badge>
					)}
					{forkedFromId && (
						<HoverCard>
							<HoverCardTrigger
								render={
									<Badge variant="outline" className="cursor-help">
										<GitForkIcon className="mr-1 h-3 w-3" />
										Forked
									</Badge>
								}
							/>
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
			</PageHeader>

			<PageContent className="flex flex-col gap-4">
				{/* Configuration Card */}
				{type === "template" && <TemplateBlockConfigCard config={config} />}
				{type === "database" && block.assets && (
					<DatabaseBlockConfigCard
						blockId={id}
						config={config}
						assetIds={block.assets}
					/>
				)}

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
					<Link
						to="/app/blocks"
						className={buttonVariants({
							variant: "outline",
						})}
					>
						← Back to Blocks
					</Link>

					<div className="flex gap-2">
						<Button variant="outline">Export Block</Button>
						<Button variant="outline">Share Block</Button>
					</div>
				</div>

				<AccessDialog
					open={isAccessOpen}
					onOpenChange={setIsAccessOpen}
					resourceRef={{ type: "block", id }}
					resourceName={name}
				/>
			</PageContent>
		</Page>
	);
}
