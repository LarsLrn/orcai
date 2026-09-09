import type { Asset, AssetWithCapabilities } from "@orcai/schema";
import {
	EditIcon,
	EyeIcon,
	FileTextIcon,
	LoaderCircleIcon,
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
import { getFileTypeLabel } from "@/lib/presentation/file-type";
import { formatDisplayDate } from "@/lib/presentation/format-timestamp";
import {
	getProcessingStatusLabel,
	getProcessingStatusVariant,
} from "@/lib/presentation/processing-status";

const AssetCard = ({
	asset,
	actions,
	className,
}: {
	asset:
		| AssetWithCapabilities
		| (Asset & {
				capabilities?: Record<string, boolean>;
		  });
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
			value: formatDisplayDate(asset.createdAt),
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
		...(hasCapability(asset.capabilities, "edit")
			? [
					{
						key: "edit",
						label: "Edit asset",
						icon: EditIcon,
						variant: "default",
						linkProps: {
							to: "/app/hub/assets/$assetId/edit",
							params: {
								assetId: asset.id,
							},
						},
					} satisfies ResourceCardActionItem,
				]
			: []),
	];

	const dropdownActions: ResourceCardActionItem[] = actions?.dropdown ?? [];

	const badges: ResourceCardBadgeItem[] = [
		{
			label: getFileTypeLabel(asset.fileType),
			variant: "outline",
		},
	];

	badges.push({
		label: getProcessingStatusLabel(asset.processingStatus),
		variant: getProcessingStatusVariant(asset.processingStatus),
		icon: asset.processingStatus === "active" ? LoaderCircleIcon : undefined,
		className:
			asset.processingStatus === "active" ? "[&>svg]:animate-spin" : undefined,
	});

	const primaryAction = actions?.primary ?? {
		linkProps: {
			to: "/app/hub/assets/$assetId",
			params: {
				assetId: asset.id,
			},
		},
	};

	let description: string | undefined;
	if (asset.metadata.chapterTitle) {
		description = `Chapter: ${asset.metadata.chapterTitle}`;
	} else if (asset.metadata.author) {
		description = `Author: ${asset.metadata.author}`;
	}

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
					<ResourceCardMedia variant="icon" tone="asset">
						<FileTextIcon />
					</ResourceCardMedia>
					<ResourceCardTitle>{asset.title}</ResourceCardTitle>
					{description && (
						<ResourceCardDescription>{description}</ResourceCardDescription>
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

export { AssetCard };
