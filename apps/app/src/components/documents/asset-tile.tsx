import type {
	Asset,
	AssetWithCapabilities,
	DocumentReadiness,
} from "@orcai/schema";
import {
	EditIcon,
	KeyRoundIcon,
	LibraryIcon,
	MessageSquareIcon,
	RefreshCwIcon,
	Trash2Icon,
} from "lucide-react";
import { useState } from "react";
import { AccessDialog } from "@/components/access/access-dialog";
import { Badge } from "@/components/ui/badge";
import type { HeaderAction } from "@/components/ui/shell/actions";
import {
	Tile,
	TileBand,
	TileBody,
	TileDescription,
	TileFooter,
	TileIcon,
	TileMark,
	TileMenu,
	TileTitle,
} from "@/components/ui/shell/tile";
import {
	useAddAssetToLibraryMutation,
	useDeleteAssetsMutation,
	useReprocessAssetMutation,
} from "@/hooks/mutations/use-asset-mutations";
import { hasCapability } from "@/lib/authz/capabilities";
import type { BadgeItem } from "@/lib/presentation/badge-item";
import {
	documentStateBadge,
	getPipelineFailureDescription,
} from "@/lib/presentation/document-state";
import { getFileTypeLabel } from "@/lib/presentation/file-type";
import {
	generatingMetadataBadge,
	isGeneratingMetadata,
} from "@/lib/presentation/metadata-status";
import { processingStatusBadge } from "@/lib/presentation/processing-status";
import { RESOURCE_KINDS } from "@/lib/presentation/resource-kind";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

type TileAsset = Pick<
	Asset,
	| "id"
	| "title"
	| "metadata"
	| "fileType"
	| "origin"
	| "processingStatus"
	| "processingFailure"
	| "metadataStatus"
> & {
	capabilities?: AssetWithCapabilities["capabilities"];
};

/** Its state in a repository, shown instead of its processing. */
type TileDocument = Pick<DocumentReadiness, "state" | "failure">;

const { Icon, well, band } = RESOURCE_KINDS.asset;

/**
 * The state badges and description of an asset tile. A finished asset shows
 * no processing state; a failed one says why in place of its description.
 */
const assetTileState = (
	asset: TileAsset,
	document?: TileDocument,
): {
	badges: BadgeItem[];
	description: string | null;
	failed: boolean;
} => {
	const failure = document
		? document.failure?.kind
		: asset.processingStatus === "failed"
			? (asset.processingFailure ?? "other")
			: undefined;
	const state = document
		? documentStateBadge(document.state)
		: asset.processingStatus === "completed"
			? null
			: processingStatusBadge(asset.processingStatus);
	const badges = [
		state,
		isGeneratingMetadata(asset) ? generatingMetadataBadge() : null,
	].filter((badge) => badge !== null);

	if (failure) {
		return {
			badges,
			description: getPipelineFailureDescription(failure, asset.fileType),
			failed: true,
		};
	}

	const { description, chapterTitle, author } = asset.metadata;
	return {
		badges,
		description:
			description ||
			(chapterTitle
				? m.assets_tile_chapter_description({
						name: chapterTitle,
					})
				: author
					? m.assets_tile_author_description({
							name: author,
						})
					: null),
		failed: false,
	};
};

/** The `…` menu of an asset tile, as far as the asset's capabilities allow. */
const assetTileActions = (
	asset: Pick<TileAsset, "id" | "origin" | "processingStatus" | "capabilities">,
	{
		onAccess,
		onAddToLibrary,
		onReprocess,
		onDelete,
	}: {
		onAccess: () => void;
		onAddToLibrary: () => void;
		onReprocess: () => void;
		onDelete: () => void;
	},
): (HeaderAction | false)[] => {
	const canEdit = hasCapability(asset.capabilities, "edit");
	const processing =
		asset.processingStatus === "pending" || asset.processingStatus === "active";

	return [
		canEdit && {
			key: "edit",
			label: m.assets_tile_edit_action(),
			icon: EditIcon,
			linkProps: {
				to: "/app/hub/assets/$assetId/edit",
				params: {
					assetId: asset.id,
				},
			},
		},
		hasCapability(asset.capabilities, "manage_access") && {
			key: "access",
			label: m.assets_tile_access_action(),
			icon: KeyRoundIcon,
			onClick: onAccess,
		},
		canEdit &&
			asset.origin === "chat" && {
				key: "add-to-library",
				label: m.assets_add_to_library_action(),
				icon: LibraryIcon,
				onClick: onAddToLibrary,
			},
		canEdit &&
			!processing && {
				key: "reprocess",
				label: m.assets_tile_reprocess_action(),
				icon: RefreshCwIcon,
				onClick: onReprocess,
			},
		hasCapability(asset.capabilities, "delete") && {
			key: "delete",
			label: m.assets_tile_delete_action(),
			icon: Trash2Icon,
			destructive: true,
			onClick: onDelete,
		},
	];
};

const AssetTileBody = ({
	asset,
	document,
	title,
}: {
	asset: TileAsset;
	document?: TileDocument;
	title: React.ReactNode;
}) => {
	const { badges, description, failed } = assetTileState(asset, document);

	return (
		<TileBody>
			{title}
			{description ? (
				<TileDescription className={cn(failed && "text-status-danger")}>
					{description}
				</TileDescription>
			) : null}
			<TileFooter>
				<span>{getFileTypeLabel(asset.fileType)}</span>
				{asset.origin === "chat" ? (
					<Badge variant="outline">
						<MessageSquareIcon aria-hidden="true" />
						{m.assets_origin_chat_badge()}
					</Badge>
				) : null}
				{badges.map((badge) => (
					<Badge
						key={badge.label}
						variant={badge.variant}
						className={badge.className}
					>
						{badge.icon ? <badge.icon aria-hidden="true" /> : null}
						{badge.label}
					</Badge>
				))}
			</TileFooter>
		</TileBody>
	);
};

const detailTitle = (asset: TileAsset) => (
	<TileTitle
		action={{
			linkProps: {
				to: "/app/hub/assets/$assetId",
				params: {
					assetId: asset.id,
				},
			},
		}}
	>
		{asset.title}
	</TileTitle>
);

/** An asset on a browsing surface: band and its `…` menu. */
const AssetTile = ({ asset }: { asset: TileAsset }) => {
	const [isAccessOpen, setIsAccessOpen] = useState(false);
	const { mutate: addToLibrary } = useAddAssetToLibraryMutation();
	const { mutate: reprocessAsset } = useReprocessAssetMutation();
	const { mutate: deleteAssets } = useDeleteAssetsMutation(
		{},
		{
			names: [
				asset.title,
			],
		},
	);

	return (
		<Tile>
			<TileBand className={band}>
				<Icon />
			</TileBand>
			<TileIcon className={well}>
				<Icon />
			</TileIcon>
			<AssetTileBody asset={asset} title={detailTitle(asset)} />
			<TileMenu
				actions={assetTileActions(asset, {
					onAccess: () => setIsAccessOpen(true),
					onAddToLibrary: () =>
						addToLibrary({
							id: asset.id,
						}),
					onReprocess: () =>
						reprocessAsset({
							id: asset.id,
						}),
					onDelete: () =>
						deleteAssets({
							refs: [
								{
									id: asset.id,
								},
							],
						}),
				})}
			/>
			{hasCapability(asset.capabilities, "manage_access") ? (
				<AccessDialog
					open={isAccessOpen}
					onOpenChange={setIsAccessOpen}
					resourceRef={{
						type: "asset",
						id: asset.id,
					}}
					resourceName={asset.title}
				/>
			) : null}
		</Tile>
	);
};

/**
 * An asset in context: a repository's document with its state and the
 * context's actions, or a picker's choice when `selection` is given.
 */
const CompactAssetTile = ({
	asset,
	document,
	actions = [],
	selection,
}: {
	asset: TileAsset;
	document?: TileDocument;
	actions?: HeaderAction[];
	selection?: {
		selected: boolean;
		onToggle: () => void;
	};
}) => (
	<Tile>
		<TileIcon className={well}>
			<Icon />
			{selection?.selected ? <TileMark /> : null}
		</TileIcon>
		<AssetTileBody
			asset={asset}
			document={document}
			title={
				selection ? (
					<TileTitle
						action={{
							onClick: selection.onToggle,
						}}
						pressed={selection.selected}
					>
						{asset.title}
					</TileTitle>
				) : (
					detailTitle(asset)
				)
			}
		/>
		<TileMenu actions={actions} />
	</Tile>
);

export { AssetTile, assetTileActions, assetTileState, CompactAssetTile };
