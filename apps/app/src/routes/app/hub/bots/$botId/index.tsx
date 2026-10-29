import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { MessageSquarePlusIcon } from "lucide-react";
import { MetadataCard } from "@/components/app/metadata-card";
import { useBotActions } from "@/components/bot/bot-actions";
import { BotBlocks } from "@/components/bot/bot-blocks";
import { BotFavouriteToggle } from "@/components/bot/bot-favourites";
import { BotSetupSummary } from "@/components/bot/setup/bot-setup-summary";
import {
	ContentRenderer,
	isContentEmpty,
} from "@/components/editor/content-renderer";
import { FeatureBadges } from "@/components/features/feature-badges";
import { Badge } from "@/components/ui/badge";
import { HeaderActions } from "@/components/ui/shell/actions";
import {
	DetailHeader,
	DetailHeaderBand,
	DetailHeaderDescription,
	DetailHeaderHeading,
	DetailHeaderIcon,
	DetailHeaderMeta,
	DetailHeaderTitle,
} from "@/components/ui/shell/detail-header";
import { Page, PageContent } from "@/components/ui/shell/page";
import { ResourceOwner } from "@/components/users/resource-owner";
import { hasCapability } from "@/lib/authz/capabilities";
import { orpc } from "@/lib/orpc/orpc";
import { getPublicationStatusLabel } from "@/lib/presentation/publication-status";
import { RESOURCE_KINDS } from "@/lib/presentation/resource-kind";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/app/hub/bots/$botId/")({
	component: RouteComponent,
});

function RouteComponent() {
	const { botId } = Route.useParams();
	const navigate = useNavigate();

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

	const { actions, dialog } = useBotActions(bot.data, {
		onDeleted: async () => {
			await navigate({
				to: "/app/hub/bots",
			});
		},
	});
	const { Icon, well, band, badge, label } = RESOURCE_KINDS.bot;
	const draft = bot.data.status === "draft";

	return (
		<Page>
			<DetailHeader>
				<DetailHeaderBand className={cn(band, draft && "opacity-45 grayscale")}>
					<Icon />
				</DetailHeaderBand>
				<DetailHeaderIcon className={well}>
					<Icon />
				</DetailHeaderIcon>
				<DetailHeaderHeading>
					<DetailHeaderTitle>{bot.data.name}</DetailHeaderTitle>
					<DetailHeaderMeta>
						<Badge variant={badge}>{label()}</Badge>
						{draft ? (
							<Badge variant="outline">
								{getPublicationStatusLabel("draft")}
							</Badge>
						) : null}
						<FeatureBadges features={bot.data.features} className="contents" />
						<ResourceOwner owner={bot.data.owner} />
					</DetailHeaderMeta>
					<HeaderActions
						leading={draft ? null : <BotFavouriteToggle bot={bot.data} />}
						actions={[
							hasCapability(bot.data.capabilities, "use") && {
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
							actions.edit,
							actions.access,
							actions.delete,
						]}
					/>
				</DetailHeaderHeading>
				{bot.data.description ? (
					<DetailHeaderDescription>
						{bot.data.description}
					</DetailHeaderDescription>
				) : null}
			</DetailHeader>

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

			{dialog}
		</Page>
	);
}
