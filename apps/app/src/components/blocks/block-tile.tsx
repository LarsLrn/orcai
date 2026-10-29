import type { Block, BlockWithCapabilities } from "@orcai/schema";
import { useBlockActions } from "@/components/blocks/block-actions";
import { Badge } from "@/components/ui/badge";
import type { HeaderAction } from "@/components/ui/shell/actions";
import {
	Tile,
	TileBand,
	TileBody,
	TileDescription,
	TileFooter,
	TileIcon,
	TileMenu,
	TileTitle,
} from "@/components/ui/shell/tile";
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

const BlockTileContent = ({ block }: { block: TileBlock }) => {
	const { Icon, well } = RESOURCE_KINDS[blockKind(block.type)];

	return (
		<>
			<TileIcon className={well}>
				<Icon />
			</TileIcon>
			<TileBody>
				<TileTitle
					action={{
						linkProps: {
							to: "/app/hub/blocks/$blockId",
							params: {
								blockId: block.id,
							},
						},
					}}
				>
					{block.name}
				</TileTitle>
				{block.description ? (
					<TileDescription>{block.description}</TileDescription>
				) : null}
				<TileFooter>
					{block.type === "template" ? (
						<span>{m.blocks_tile_behaviour_contents()}</span>
					) : null}
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
const BlockTile = ({ block }: { block: TileBlock }) => {
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
			<BlockTileContent block={block} />
			<TileMenu
				actions={[
					actions.edit,
					actions.access,
					actions.delete,
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

export { BlockTile, CompactBlockTile };
