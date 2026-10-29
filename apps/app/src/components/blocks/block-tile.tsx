import type { Block, BlockWithCapabilities } from "@orcai/schema";
import { EditIcon, KeyRoundIcon, Trash2Icon } from "lucide-react";
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
	TileMenu,
	TileTitle,
} from "@/components/ui/shell/tile";
import { useDeleteBlocksMutation } from "@/hooks/mutations/use-block-mutations";
import { hasCapability } from "@/lib/authz/capabilities";
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

/** The `…` menu of a behaviour or repository tile, as far as its capabilities allow. */
const blockTileActions = (
	block: Pick<TileBlock, "id" | "capabilities">,
	{
		onAccess,
		onDelete,
	}: {
		onAccess: () => void;
		onDelete: () => void;
	},
): (HeaderAction | false)[] => [
	hasCapability(block.capabilities, "edit") && {
		key: "edit",
		label: m.blocks_tile_edit_action(),
		icon: EditIcon,
		linkProps: {
			to: "/app/hub/blocks/$blockId/edit",
			params: {
				blockId: block.id,
			},
		},
	},
	hasCapability(block.capabilities, "manage_access") && {
		key: "access",
		label: m.blocks_tile_access_action(),
		icon: KeyRoundIcon,
		onClick: onAccess,
	},
	hasCapability(block.capabilities, "delete") && {
		key: "delete",
		label: m.blocks_tile_delete_action(),
		icon: Trash2Icon,
		destructive: true,
		onClick: onDelete,
	},
];

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
	const [isAccessOpen, setIsAccessOpen] = useState(false);
	const { mutate: deleteBlocks } = useDeleteBlocksMutation(
		{},
		{
			names: [
				block.name,
			],
			kind,
		},
	);

	return (
		<Tile>
			<TileBand
				className={cn(band, block.status === "draft" && "opacity-45 grayscale")}
			>
				<Icon />
			</TileBand>
			<BlockTileContent block={block} />
			<TileMenu
				actions={blockTileActions(block, {
					onAccess: () => setIsAccessOpen(true),
					onDelete: () =>
						deleteBlocks({
							refs: [
								{
									id: block.id,
								},
							],
						}),
				})}
			/>
			{hasCapability(block.capabilities, "manage_access") ? (
				<AccessDialog
					open={isAccessOpen}
					onOpenChange={setIsAccessOpen}
					resourceRef={{
						type: "block",
						id: block.id,
					}}
					resourceName={block.name}
				/>
			) : null}
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
