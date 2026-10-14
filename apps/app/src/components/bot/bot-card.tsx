import type { BotWithCapabilities } from "@orcai/schema";
import { BotIcon, EditIcon, EyeIcon } from "lucide-react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
	ResourceCardMenuTrigger,
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
			label:
				bot.status === "ready"
					? m.bots_card_published_badge()
					: m.bots_card_draft_badge(),
			variant: bot.status === "ready" ? "success" : "outline",
		},
		{
			label: `v${bot.version}`,
			variant: "outline",
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

	return (
		<ResourceCard>
			{dropdownActions.length > 0 ? (
				<ResourceCardMenu>
					<DropdownMenu>
						<DropdownMenuTrigger render={<ResourceCardMenuTrigger />} />
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
				</ResourceCardMenu>
			) : null}

			<ResourceCardBody action={primaryAction}>
				<ResourceCardHeader>
					<ResourceCardMedia variant="icon" tone="bot">
						<BotIcon />
					</ResourceCardMedia>
					<ResourceCardTitle>{bot.name}</ResourceCardTitle>
					{bot.description ? (
						<ResourceCardDescription>{bot.description}</ResourceCardDescription>
					) : null}
				</ResourceCardHeader>
				<ResourceCardContent>
					<ResourceCardBadges badges={badges} />
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
