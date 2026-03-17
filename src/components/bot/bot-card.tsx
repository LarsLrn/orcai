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
import type { Bot } from "@/lib/orpc/schemas/bot";

const BotCard = ({
	bot,
	actions,
}: {
	bot: Bot;
	actions?: {
		dropdown?: ResourceCardActionItem[];
		footer?: ResourceCardActionItem[];
		primary?: ResourceCardPrimaryAction;
	};
}) => {
	const meta: ResourceCardMetaItem[] = [];
	if (bot.createdAt) {
		meta.push({
			label: "Created",
			value: new Date(bot.createdAt).toLocaleDateString(),
		});
	}

	const footerActions: ResourceCardActionItem[] = actions?.footer ?? [
		{
			key: "view",
			label: "View",
			icon: EyeIcon,
			linkProps: {
				to: "/app/hub/bots/$botId",
				params: {
					botId: bot.id,
				},
			},
		},
		{
			key: "edit",
			label: "Edit Bot",
			icon: EditIcon,
			variant: "default",
			linkProps: {
				to: "/app/hub/bots/$botId/setup",
				params: {
					botId: bot.id,
				},
			},
		},
	];

	const dropdownActions: ResourceCardActionItem[] = actions?.dropdown ?? [];

	const badges: ResourceCardBadgeItem[] = [
		{
			label: `v${bot.version}`,
			variant: "outline",
		},
	];

	if (bot.status === "draft") {
		badges.push({
			label: "Draft",
			variant: "destructive",
		});
	}

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
					<ResourceCardMedia variant="icon">
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
