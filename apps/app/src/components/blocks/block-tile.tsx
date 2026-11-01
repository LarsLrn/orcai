import type {
	Block,
	BlockListItem,
	BlockWithCapabilities,
	RepositoryTotals,
} from "@orcai/schema";
import { LoaderCircleIcon } from "lucide-react";
import { useBlockActions } from "@/components/blocks/block-actions";
import { ResourceProvenance } from "@/components/catalogue/resource-provenance";
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
	TileMenu,
	TileProvenance,
	TileTitle,
} from "@/components/ui/shell/tile";
import { blockPaths } from "@/lib/navigation/block-paths";
import type { BadgeItem } from "@/lib/presentation/badge-item";
import { getPublicationStatusLabel } from "@/lib/presentation/publication-status";
import { RESOURCE_KINDS } from "@/lib/presentation/resource-kind";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

type TileBlock = Pick<
	Block,
	"id" | "type" | "name" | "description" | "status"
> & {
	capabilities?: BlockWithCapabilities["capabilities"];
};

/** A block as library lists return it, with its tile details. */
type BrowseBlock = TileBlock &
	Pick<BlockListItem, "owner" | "assets" | "homeOrganization">;

/** A repository's asset count, and badges for those still processing or failed. */
const repositoryFooter = (
	assets: RepositoryTotals,
): {
	label: string;
	badges: BadgeItem[];
} => ({
	label:
		assets.total === 0
			? m.blocks_tile_no_assets()
			: m.blocks_tile_assets({
					count: assets.total,
				}),
	badges: [
		assets.preparing > 0 && {
			label: m.blocks_tile_assets_preparing({
				count: assets.preparing,
			}),
			variant: "info" as const,
			icon: LoaderCircleIcon,
			className: "[&>svg]:animate-spin",
		},
		assets.failed > 0 && {
			label: m.blocks_tile_assets_failed({
				count: assets.failed,
			}),
			variant: "danger" as const,
		},
	].filter((badge) => badge !== false),
});

const BlockTileContent = ({
	block,
	provenance,
	assets,
}: {
	block: TileBlock;
	provenance?: React.ReactNode;
	/** A repository's assets, when known. */
	assets?: RepositoryTotals | null;
}) => {
	const { Icon, well } = RESOURCE_KINDS[block.type];
	const repository = assets ? repositoryFooter(assets) : null;

	return (
		<>
			<TileIcon className={well}>
				<Icon />
			</TileIcon>
			<TileBody>
				<TileTitle
					action={{
						linkProps: {
							to: blockPaths(block.type).detail,
							params: {
								blockId: block.id,
							},
						},
					}}
				>
					{block.name}
				</TileTitle>
				{provenance}
				{block.description ? (
					<TileDescription>{block.description}</TileDescription>
				) : null}
				<TileFooter>
					{block.type === "behaviour" ? (
						<span>{m.blocks_tile_behaviour_contents()}</span>
					) : null}
					{repository ? <span>{repository.label}</span> : null}
					{repository ? <TileBadges badges={repository.badges} /> : null}
					{block.status === "draft" ? (
						<Badge variant="outline">
							{getPublicationStatusLabel("draft")}
						</Badge>
					) : null}
				</TileFooter>
			</TileBody>
		</>
	);
};

/** A behaviour or repository on a browsing surface: band and its `…` menu. */
const BlockTile = ({ block }: { block: BrowseBlock }) => {
	const kind = block.type;
	const { Icon, band } = RESOURCE_KINDS[kind];
	const { actions, dialog } = useBlockActions(block);

	return (
		<Tile>
			<TileBand
				className={cn(band, block.status === "draft" && "opacity-45 grayscale")}
			>
				<Icon />
			</TileBand>
			<BlockTileContent
				block={block}
				provenance={
					<TileProvenance>
						<ResourceProvenance
							owner={block.owner}
							homeOrganization={block.homeOrganization}
						/>
					</TileProvenance>
				}
				assets={block.assets}
			/>
			<TileMenu
				actions={[
					actions.edit,
					actions.access,
					actions.handOver,
					actions.delete,
					actions.remove,
				]}
			/>
			{dialog}
		</Tile>
	);
};

/** A behaviour or repository in context, with the context's own actions. */
const CompactBlockTile = ({
	block,
	actions = [],
}: {
	block: TileBlock;
	actions?: HeaderAction[];
}) => (
	<Tile>
		<BlockTileContent block={block} />
		<TileMenu actions={actions} />
	</Tile>
);

export { BlockTile, CompactBlockTile, repositoryFooter };
