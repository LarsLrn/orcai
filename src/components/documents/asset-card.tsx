import { EditIcon, EyeIcon, FileTextIcon } from "lucide-react";
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
import type { Asset } from "@/lib/orpc/schemas/asset";
import { getProcessingStatusLabel } from "@/lib/presentation/processing-status";

const AssetCard = ({
	asset,
	actions,
	className,
}: {
	asset: Asset;
	actions?: {
		dropdown?: ResourceCardActionItem[];
		footer?: ResourceCardActionItem[];
		primary?: ResourceCardPrimaryAction;
	};
	className?: string;
}) => {
	const meta: ResourceCardMetaItem[] = [];
	if (asset.createdAt) {
		meta.push({
			label: "Created",
			value: new Date(asset.createdAt).toLocaleDateString(),
		});
	}

	const footerActions: ResourceCardActionItem[] = actions?.footer ?? [
		{
			key: "view",
			label: "View",
			icon: EyeIcon,
			linkProps: {
				to: "/app/hub/assets/$assetId",
				params: {
					assetId: asset.id,
				},
			},
		},
		{
			key: "edit",
			label: "Edit content",
			icon: EditIcon,
			variant: "default",
			linkProps: {
				to: "/app/hub/assets/$assetId/edit",
				params: {
					assetId: asset.id,
				},
			},
		},
	];

	const dropdownActions: ResourceCardActionItem[] = actions?.dropdown ?? [];

	const badges: ResourceCardBadgeItem[] = [
		{
			label: asset.fileType,
			variant: "outline",
		},
	];

	if (asset.processingStatus === "failed") {
		badges.push({
			label: getProcessingStatusLabel(asset.processingStatus),
			variant: "destructive",
		});
	}

	if (asset.processingStatus === "active") {
		badges.push({
			label: getProcessingStatusLabel(asset.processingStatus),
			variant: "default",
		});
	}

	if (asset.processingStatus === "pending") {
		badges.push({
			label: getProcessingStatusLabel(asset.processingStatus),
			variant: "secondary",
		});
	}

	if (asset.processingStatus === "completed") {
		badges.push({
			label: getProcessingStatusLabel(asset.processingStatus),
			variant: "outline",
		});
	}

	const primaryAction = actions?.primary ?? {
		linkProps: {
			to: "/app/hub/assets/$assetId",
			params: {
				assetId: asset.id,
			},
		},
	};

	return (
		<ResourceCard className={className}>
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
									{action.icon ? (
										<action.icon className="mr-2 h-4 w-4" />
									) : null}
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
						<FileTextIcon className="text-emerald-600 dark:text-emerald-400" />
					</ResourceCardMedia>
					<ResourceCardTitle>{asset.title}</ResourceCardTitle>
					<ResourceCardDescription>
						{asset.fileType.toUpperCase()}
					</ResourceCardDescription>
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

export { AssetCard };
