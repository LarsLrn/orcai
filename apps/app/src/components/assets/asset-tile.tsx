import type {
	Asset,
	AssetListItem,
	AssetReadiness,
	AssetWithCapabilities,
} from "@orcai/schema";
import { MessageSquareIcon } from "lucide-react";
import { useAssetActions } from "@/components/assets/asset-actions";
import { Badge } from "@/components/ui/badge";
import type { HeaderAction } from "@/components/ui/shell/actions";
import {
	Tile,
	TileBadges,
	TileBand,
	TileBody,
	TileDescription,
	TileFooter,
	TileIcon,
	TileMark,
	TileMenu,
	TileProvenance,
	TileTitle,
} from "@/components/ui/shell/tile";
import { ResourceOwner } from "@/components/users/resource-owner";
import {
	assetStateBadge,
	getPipelineFailureDescription,
} from "@/lib/presentation/asset-state";
import type { BadgeItem } from "@/lib/presentation/badge-item";
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
	| "keptIn"
	| "processingStatus"
	| "processingFailure"
	| "metadataStatus"
> & {
	capabilities?: AssetWithCapabilities["capabilities"];
};

/** Its state in a repository, shown instead of its processing. */
type TileReadiness = Pick<AssetReadiness, "state" | "failure">;

const { Icon, well, band } = RESOURCE_KINDS.asset;

/**
 * The state badges and description of an asset tile. A finished asset shows
 * no processing state; a failed one says why in place of its description.
 */
const assetTileState = (
	asset: TileAsset,
	readiness?: TileReadiness,
): {
	badges: BadgeItem[];
	description: string | null;
	failed: boolean;
} => {
	const failure = readiness
		? readiness.failure?.kind
		: asset.processingStatus === "failed"
			? (asset.processingFailure ?? "other")
			: undefined;
	const state = readiness
		? assetStateBadge(readiness.state)
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

const AssetTileBody = ({
	asset,
	readiness,
	title,
	provenance,
}: {
	asset: TileAsset;
	readiness?: TileReadiness;
	title: React.ReactNode;
	provenance?: React.ReactNode;
}) => {
	const { badges, description, failed } = assetTileState(asset, readiness);

	return (
		<TileBody>
			{title}
			{provenance}
			{description ? (
				<TileDescription className={cn(failed && "text-status-danger")}>
					{description}
				</TileDescription>
			) : null}
			<TileFooter>
				<span>{getFileTypeLabel(asset.fileType)}</span>
				{asset.keptIn === "chat" ? (
					<Badge variant="outline">
						<MessageSquareIcon aria-hidden="true" />
						{m.assets_chat_upload_badge()}
					</Badge>
				) : null}
				<TileBadges badges={badges} />
			</TileFooter>
		</TileBody>
	);
};

const detailTitle = (asset: TileAsset) => (
	<TileTitle
		action={{
			linkProps: {
				to: "/app/library/assets/$assetId",
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
const AssetTile = ({
	asset,
}: {
	asset: TileAsset & Pick<AssetListItem, "owner">;
}) => {
	const { actions, dialog } = useAssetActions(asset);

	return (
		<Tile>
			<TileBand className={band}>
				<Icon />
			</TileBand>
			<TileIcon className={well}>
				<Icon />
			</TileIcon>
			<AssetTileBody
				asset={asset}
				title={detailTitle(asset)}
				provenance={
					<TileProvenance>
						<ResourceOwner owner={asset.owner} />
					</TileProvenance>
				}
			/>
			<TileMenu
				actions={[
					actions.edit,
					actions.access,
					actions.handOver,
					actions.addToLibrary,
					actions.prepareAgain,
					actions.delete,
				]}
			/>
			{dialog}
		</Tile>
	);
};

/**
 * An asset in context: a repository's asset with its state and the
 * context's actions, or a picker's choice when `selection` is given.
 */
const CompactAssetTile = ({
	asset,
	readiness,
	actions = [],
	selection,
}: {
	asset: TileAsset;
	readiness?: TileReadiness;
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
			readiness={readiness}
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

export { AssetTile, assetTileState, CompactAssetTile };
