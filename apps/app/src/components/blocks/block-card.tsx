import type { Block, BlockWithCapabilities } from "@orcai/schema";
import {
	BrainCircuitIcon,
	DatabaseIcon,
	EditIcon,
	EyeIcon,
	ImageIcon,
	type LucideIcon,
} from "lucide-react";
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

const BLOCK_TYPE_CONFIG = {
	template: {
		Icon: BrainCircuitIcon,
		tone: "behaviour",
		badgeTone: "kind-behaviour",
	},
	database: {
		Icon: DatabaseIcon,
		tone: "repository",
		badgeTone: "kind-repository",
	},
	imageGeneration: {
		Icon: ImageIcon,
		tone: "behaviour",
		badgeTone: "kind-behaviour",
	},
} satisfies Record<
	Block["type"],
	{
		Icon: LucideIcon;
		tone: React.ComponentProps<typeof ResourceCardMedia>["tone"];
		badgeTone: ResourceCardBadgeItem["variant"];
	}
>;

const getBlockTypeLabel = (type: Block["type"]) =>
	type === "template"
		? "Behaviour"
		: type === "database"
			? "Repository"
			: "Image generation";

const BlockCard = ({
	block,
	actions,
}: {
	block:
		| BlockWithCapabilities
		| (Block & {
				capabilities?: Record<string, boolean>;
		  });
	actions?: {
		dropdown?: ResourceCardActionItem[];
		footer?: ResourceCardActionItem[];
		primary?: ResourceCardPrimaryAction;
	};
}) => {
	const { Icon, tone, badgeTone } = BLOCK_TYPE_CONFIG[block.type];

	const meta: ResourceCardMetaItem[] = [];
	if (block.createdAt) {
		meta.push({
			label: "Created",
			value: formatDisplayDate(block.createdAt),
		});
	}

	const footerActions: ResourceCardActionItem[] = actions?.footer ?? [
		{
			key: "view",
			label: "View",
			icon: EyeIcon,
			linkProps: {
				to: "/app/hub/blocks/$blockId",
				params: {
					blockId: block.id,
				},
			},
		},
		...(hasCapability(block.capabilities, "edit")
			? [
					{
						key: "edit",
						label: "Edit",
						icon: EditIcon,
						variant: "default",
						linkProps: {
							to: "/app/hub/blocks/$blockId/edit",
							params: {
								blockId: block.id,
							},
						},
					} satisfies ResourceCardActionItem,
				]
			: []),
	];

	const dropdownActions: ResourceCardActionItem[] = actions?.dropdown ?? [];

	const badges: ResourceCardBadgeItem[] = [
		{
			label: `v${block.version}`,
			variant: "outline",
		},
		{
			label: getBlockTypeLabel(block.type),
			variant: badgeTone,
		},
	];

	if (block.status === "draft") {
		badges.push({
			label: "Draft",
			variant: "outline",
		});
	}

	const primaryAction = actions?.primary ?? {
		linkProps: {
			to: "/app/hub/blocks/$blockId",
			params: {
				blockId: block.id,
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
					<ResourceCardMedia variant="icon" tone={tone}>
						<Icon />
					</ResourceCardMedia>
					<ResourceCardTitle>{block.name}</ResourceCardTitle>
					{block.description && (
						<ResourceCardDescription>
							{block.description}
						</ResourceCardDescription>
					)}
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

export { BlockCard };
