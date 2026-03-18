import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
	EditIcon,
	KeyRoundIcon,
	MoreVerticalIcon,
	Trash2Icon,
} from "lucide-react";
import { useState } from "react";
import { AccessDialog } from "@/components/access/access-dialog";
import { MetadataCard } from "@/components/app/metadata-card";
import { BotBlocks } from "@/components/bot/bot-blocks";
import { ContentRenderer } from "@/components/editor/content-renderer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Page,
	PageAction,
	PageContent,
	PageDescription,
	PageHeader,
	PageTitle,
} from "@/components/ui/shell/page";
import { useDeleteBotsMutation } from "@/hooks/mutations/use-bot-mutations";
import { orpc } from "@/lib/orpc/orpc";

export const Route = createFileRoute("/app/hub/bots/$botId/")({
	component: RouteComponent,
});

function RouteComponent() {
	const { botId } = Route.useParams();
	const navigate = useNavigate();
	const [isAccessOpen, setIsAccessOpen] = useState(false);

	const { data: bot } = useSuspenseQuery(
		orpc.bot.find.queryOptions({
			input: {
				id: botId,
			},
		}),
	);
	const { data: visibility } = useSuspenseQuery(
		orpc.resource.getVisibility.queryOptions({
			input: {
				resourceType: "bot",
				resourceId: botId,
			},
		}),
	);

	const { data: blocks } = useSuspenseQuery(
		orpc.block.list.queryOptions({
			input: {
				filters: {
					botId,
					status: "ready",
				},
			},
		}),
	);
	const { data: draftBlocks } = useSuspenseQuery(
		orpc.block.list.queryOptions({
			input: {
				filters: {
					botId,
					status: "draft",
				},
			},
		}),
	);

	const botBlocks =
		bot.data.status === "draft"
			? [
					...blocks.data,
					...draftBlocks.data.filter(
						(draftBlock) =>
							!blocks.data.some(
								(readyBlock) => readyBlock.id === draftBlock.id,
							),
					),
				]
			: blocks.data;

	const { mutate: deleteBots } = useDeleteBotsMutation({
		onMutate: async () => {
			// Navigate away before deleting to avoid rendering the deleted bot.
			await navigate({
				to: "/app/hub/bots",
			});
		},
	});

	return (
		<Page>
			<PageHeader>
				<PageTitle>{bot.data.name}</PageTitle>
				<PageDescription>{bot.data.description}</PageDescription>
				{bot.data.status === "draft" ? (
					<div>
						<Badge variant="destructive">Draft</Badge>
					</div>
				) : null}
				<PageAction>
					<Button
						onClick={() =>
							navigate({
								to: "/app/chat/new",
								search: {
									botId: bot.data.id,
								},
							})
						}
					>
						Start chat
					</Button>
					<DropdownMenu>
						<DropdownMenuTrigger
							render={
								<Button variant="ghost" size="icon">
									<MoreVerticalIcon className="size-4" />
									<span className="sr-only">More options</span>
								</Button>
							}
						/>
						<DropdownMenuContent align="end">
							<DropdownMenuItem onClick={() => setIsAccessOpen(true)}>
								<KeyRoundIcon className="size-4" />
								Access & Groups
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() =>
									navigate({
										to: "/app/hub/bots/$botId/setup",
										params: {
											botId: bot.data.id,
										},
									})
								}
							>
								<EditIcon />
								Edit Bot
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								variant="destructive"
								onClick={() =>
									deleteBots({
										refs: [
											{
												id: bot.data.id,
											},
										],
									})
								}
							>
								<Trash2Icon />
								Delete Bot
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</PageAction>
			</PageHeader>

			<PageContent className="grid gap-6 lg:grid-cols-3">
				<div className="space-y-6 lg:col-span-2">
					<div className="mt-2 rounded-md border bg-muted/30 p-3 text-sm">
						<div className="prose prose-sm max-w-none">
							<ContentRenderer html={bot.data.contentHtml} />
						</div>
					</div>
					<BotBlocks blocks={botBlocks} />
				</div>

				<div className="space-y-6">
					<MetadataCard
						createdAt={bot.data.createdAt}
						updatedAt={bot.data.updatedAt}
						visibility={visibility.data.visibility}
						version={bot.data.version}
						id={bot.data.id}
					/>
				</div>
			</PageContent>

			<AccessDialog
				open={isAccessOpen}
				onOpenChange={setIsAccessOpen}
				resourceRef={{
					type: "bot",
					id: bot.data.id,
				}}
				resourceName={bot.data.name}
			/>
		</Page>
	);
}
