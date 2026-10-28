import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
	EditIcon,
	KeyRoundIcon,
	MessageSquarePlusIcon,
	Trash2Icon,
} from "lucide-react";
import { useState } from "react";
import { AccessDialog } from "@/components/access/access-dialog";
import { MetadataCard } from "@/components/app/metadata-card";
import { BotBlocks } from "@/components/bot/bot-blocks";
import { BotFavouriteToggle } from "@/components/bot/bot-favourites";
import { BotSetupSummary } from "@/components/bot/setup/bot-setup-summary";
import {
	ContentRenderer,
	isContentEmpty,
} from "@/components/editor/content-renderer";
import {
	enabledFeatureIds,
	FeatureBadges,
} from "@/components/features/feature-badges";
import { Badge } from "@/components/ui/badge";
import { HeaderActions } from "@/components/ui/shell/actions";
import {
	Page,
	PageContent,
	PageDescription,
	PageHeader,
	PageTitle,
} from "@/components/ui/shell/page";
import { useDeleteBotsMutation } from "@/hooks/mutations/use-bot-mutations";
import { hasCapability } from "@/lib/authz/capabilities";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

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

	const { mutate: deleteBots } = useDeleteBotsMutation(
		{
			onSuccess: async () => {
				await navigate({
					to: "/app/hub/bots",
				});
			},
		},
		{
			names: [
				bot.data.name,
			],
		},
	);
	const canUse = hasCapability(bot.data.capabilities, "use");
	const canEdit = hasCapability(bot.data.capabilities, "edit");
	const canDelete = hasCapability(bot.data.capabilities, "delete");
	const canManageAccess = hasCapability(bot.data.capabilities, "manage_access");

	return (
		<Page>
			<PageHeader>
				<PageTitle>{bot.data.name}</PageTitle>
				<PageDescription>{bot.data.description}</PageDescription>
				{bot.data.status === "draft" ||
				enabledFeatureIds(bot.data.features).length > 0 ? (
					<div className="flex flex-wrap gap-1.5">
						{bot.data.status === "draft" ? (
							<Badge variant="outline">{m.bots_detail_draft_badge()}</Badge>
						) : null}
						<FeatureBadges features={bot.data.features} className="contents" />
					</div>
				) : null}
				<HeaderActions
					leading={
						bot.data.status === "ready" ? (
							<BotFavouriteToggle bot={bot.data} />
						) : null
					}
					actions={[
						canUse && {
							key: "start-chat",
							label: m.bots_detail_start_chat_action(),
							icon: MessageSquarePlusIcon,
							variant: "default",
							linkProps: {
								to: "/app/chat/new",
								search: {
									botId: bot.data.id,
								},
							},
						},
						canEdit && {
							key: "edit",
							label: m.bots_detail_edit_action(),
							icon: EditIcon,
							linkProps: {
								to: "/app/hub/bots/$botId/setup",
								params: {
									botId: bot.data.id,
								},
							},
						},
						canManageAccess && {
							key: "access",
							label: m.bots_detail_access_action(),
							icon: KeyRoundIcon,
							onClick: () => setIsAccessOpen(true),
						},
						canDelete && {
							key: "delete",
							label: m.bots_detail_delete_action(),
							icon: Trash2Icon,
							destructive: true,
							onClick: () =>
								deleteBots({
									refs: [
										{
											id: bot.data.id,
										},
									],
								}),
						},
					]}
				/>
			</PageHeader>

			<PageContent className="grid grid-cols-1 gap-6 lg:grid-cols-3">
				<div className="space-y-6 lg:col-span-2">
					{isContentEmpty(bot.data.contentJson) ? null : (
						<div className="mt-2 rounded-md border bg-muted/30 p-3 text-sm">
							<div className="prose prose-sm max-w-none">
								<ContentRenderer content={bot.data.contentJson} />
							</div>
						</div>
					)}
					<BotBlocks blocks={botBlocks} />
				</div>

				<div className="space-y-6">
					<BotSetupSummary botId={bot.data.id} />
					<MetadataCard
						createdAt={bot.data.createdAt}
						updatedAt={bot.data.updatedAt}
						visibility={visibility.data.visibility}
						id={bot.data.id}
					/>
				</div>
			</PageContent>

			{canManageAccess ? (
				<AccessDialog
					open={isAccessOpen}
					onOpenChange={setIsAccessOpen}
					resourceRef={{
						type: "bot",
						id: bot.data.id,
					}}
					resourceName={bot.data.name}
				/>
			) : null}
		</Page>
	);
}
