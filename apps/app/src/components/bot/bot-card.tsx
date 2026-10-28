import type { BotWithCapabilities } from "@orcai/schema";
import { BotIcon, EditIcon, EyeIcon } from "lucide-react";
import { BotFavouriteToggle } from "@/components/bot/bot-favourites";
import { FeatureBadges } from "@/components/features/feature-badges";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { OverflowMenuTrigger } from "@/components/ui/shell/actions";
import {
	ResourceCard,
	ResourceCardAction as ResourceCardActionButton,
	type ResourceCardActionItem,
	type ResourceCardBadgeItem,
	ResourceCardBadges,
	ResourceCardBody,
	ResourceCardContent,
	ResourceCardDescription,
	ResourceCardFooter,
	ResourceCardHeader,
	ResourceCardMedia,
	ResourceCardMenu,
	ResourceCardMeta,
	type ResourceCardMetaItem,
	type ResourceCardPrimaryAction,
	ResourceCardTitle,
} from "@/components/ui/shell/resource-card";
import { hasCapability } from "@/lib/authz/capabilities";
import { formatDisplayDate } from "@/lib/presentation/format-timestamp";
import { m } from "@/paraglide/messages";

const BotCard = ({
	bot,
	actions,
}: {
	bot: BotWithCapabilities;
	actions?: {
		dropdown?: ResourceCardActionItem[];
		footer?: ResourceCardActionItem[];
		primary?: ResourceCardPrimaryAction;
	};
}) => {
	const isPublished = bot.status === "ready";
	const meta: ResourceCardMetaItem[] = [];
	if (bot.createdAt) {
		meta.push({
			label: m.bots_card_created_meta_label(),
			value: formatDisplayDate(bot.createdAt),
		});
	}

	const footerActions: ResourceCardActionItem[] = actions?.footer ?? [
		{
			key: "view",
			label: m.bots_card_view_action(),
			icon: EyeIcon,
			linkProps: {
				to: "/app/hub/bots/$botId",
				params: {
					botId: bot.id,
				},
			},
		},
		...(hasCapability(bot.capabilities, "edit")
			? [
					{
						key: "edit",
						label: m.bots_card_edit_action(),
						icon: EditIcon,
						variant: "outline",
						linkProps: {
							to: "/app/hub/bots/$botId/setup",
							params: {
								botId: bot.id,
							},
						},
					} satisfies ResourceCardActionItem,
				]
			: []),
	];

	const dropdownActions: ResourceCardActionItem[] = actions?.dropdown ?? [];

	const badges: ResourceCardBadgeItem[] = [
		{
			label: isPublished
				? m.bots_card_published_badge()
				: m.bots_card_draft_badge(),
			variant: isPublished ? "success" : "outline",
		},
	];

	const primaryAction = actions?.primary ?? {
		linkProps: {
			to: "/app/hub/bots/$botId",
			params: {
				botId: bot.id,
			},
		},
	};

	const hasMenu = isPublished || dropdownActions.length > 0;

	return (
		<ResourceCard>
			{hasMenu ? (
				<ResourceCardMenu>
					{isPublished ? <BotFavouriteToggle bot={bot} /> : null}
					{dropdownActions.length > 0 ? (
						<DropdownMenu>
							<DropdownMenuTrigger
								render={<OverflowMenuTrigger variant="ghost" />}
							/>
							<DropdownMenuContent align="end" className="w-40">
								{dropdownActions.map((action) => (
									<DropdownMenuItem
										key={action.key}
										onClick={() => {
											if (action.onClick) {
												action.onClick();
											}
										}}
									>
										{action.icon ? <action.icon /> : null}
										{action.label}
									</DropdownMenuItem>
								))}
							</DropdownMenuContent>
						</DropdownMenu>
					) : null}
				</ResourceCardMenu>
			) : null}

			<ResourceCardBody action={primaryAction}>
				<ResourceCardHeader className={hasMenu ? "pr-10" : undefined}>
					<ResourceCardMedia variant="icon" tone="bot">
						<BotIcon />
					</ResourceCardMedia>
					<ResourceCardTitle>{bot.name}</ResourceCardTitle>
					{bot.description ? (
						<ResourceCardDescription>{bot.description}</ResourceCardDescription>
					) : null}
				</ResourceCardHeader>
				<ResourceCardContent>
					<div className="flex flex-wrap gap-1.5">
						<ResourceCardBadges badges={badges} className="contents" />
						<FeatureBadges features={bot.features} className="contents" />
					</div>
					<ResourceCardMeta meta={meta} />
				</ResourceCardContent>
			</ResourceCardBody>

			{footerActions.length > 0 ? (
				<ResourceCardFooter>
					{footerActions.map((action) => (
						<ResourceCardActionButton key={action.key} action={action} />
					))}
				</ResourceCardFooter>
			) : null}
		</ResourceCard>
	);
};

export { BotCard };
