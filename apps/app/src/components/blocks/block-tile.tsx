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
import { blockKind, RESOURCE_KINDS } from "@/lib/presentation/resource-kind";
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
	Pick<BlockListItem, "owner" | "documents" | "installedFrom">;

/** A repository's document count, and badges for those still processing or failed. */
const repositoryFooter = (
	documents: RepositoryTotals,
): {
	label: string;
	badges: BadgeItem[];
} => ({
	label:
		documents.total === 0
			? m.blocks_tile_no_documents()
			: m.blocks_tile_documents({
					count: documents.total,
				}),
	badges: [
		documents.preparing > 0 && {
			label: m.blocks_tile_documents_preparing({
				count: documents.preparing,
			}),
			variant: "info" as const,
			icon: LoaderCircleIcon,
			className: "[&>svg]:animate-spin",
		},
		documents.failed > 0 && {
			label: m.blocks_tile_documents_failed({
				count: documents.failed,
			}),
			variant: "danger" as const,
		},
	].filter((badge) => badge !== false),
});

const BlockTileContent = ({
	block,
	provenance,
	documents,
}: {
	block: TileBlock;
	provenance?: React.ReactNode;
	/** A repository's documents, when known. */
	documents?: RepositoryTotals | null;
}) => {
	const { Icon, well } = RESOURCE_KINDS[blockKind(block.type)];
	const repository = documents ? repositoryFooter(documents) : null;

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
					{block.type === "template" ? (
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
	const kind = blockKind(block.type);
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
							installedFrom={block.installedFrom}
						/>
					</TileProvenance>
				}
				documents={block.documents}
			/>
			<TileMenu
				actions={[
					actions.edit,
					actions.access,
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
