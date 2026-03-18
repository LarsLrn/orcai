import {
	BrainCircuitIcon,
	DatabaseIcon,
	EditIcon,
	EyeIcon,
	ImageIcon,
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
import type { Block } from "@/lib/orpc/schemas/block";

const BLOCK_TYPE_CONFIG = {
	template: {
		Icon: BrainCircuitIcon,
		iconBg: "bg-amber-500/10",
		iconColor: "text-amber-600 dark:text-amber-400",
	},
	database: {
		Icon: DatabaseIcon,
		iconBg: "bg-sky-500/10",
		iconColor: "text-sky-600 dark:text-sky-400",
	},
	imageGeneration: {
		Icon: ImageIcon,
		iconBg: "bg-violet-500/10",
		iconColor: "text-violet-600 dark:text-violet-400",
	},
} satisfies Record<
	Block["type"],
	{
		Icon: any;
		iconBg: string;
		iconColor: string;
	}
>;

const getBlockTypeLabel = (type: Block["type"]) =>
	type === "template"
		? "Behaviour"
		: type === "database"
			? "Content Collection"
			: "Image Generation";

const BlockCard = ({
	block,
	actions,
}: {
	block: Block;
	actions?: {
		dropdown?: ResourceCardActionItem[];
		footer?: ResourceCardActionItem[];
		primary?: ResourceCardPrimaryAction;
	};
}) => {
	const { Icon, iconBg, iconColor } = BLOCK_TYPE_CONFIG[block.type];

	const meta: ResourceCardMetaItem[] = [];
	if (block.createdAt) {
		meta.push({
			label: "Created",
			value: new Date(block.createdAt).toLocaleDateString(),
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
		},
	];

	const dropdownActions: ResourceCardActionItem[] = actions?.dropdown ?? [];

	const badges: ResourceCardBadgeItem[] = [
		{
			label: `v${block.version}`,
			variant: "outline",
		},
		{
			label: getBlockTypeLabel(block.type),
			variant: "secondary",
		},
	];

	if (block.status === "draft") {
		badges.push({
			label: "Draft",
			variant: "destructive",
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
					<ResourceCardMedia variant="icon" className={iconBg}>
						<Icon className={iconColor} />
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
