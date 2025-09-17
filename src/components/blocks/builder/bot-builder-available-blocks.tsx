import { Badge } from "@/components/ui/badge";
import type { Block } from "@/lib/orpc/schemas/block";
import { DROP_ZONE_IDS } from "@/settings/bots";
import { DraggableBlock } from "./draggable-block";
import { DroppableZone } from "./droppable-zone";

interface BotBuilderAvailableBlocksProps {
	templateBlocks: Block[];
	databaseBlocks: Block[];
	isDragging: boolean;
}

const BotBuilderAvailableBlocks = ({
	templateBlocks,
	databaseBlocks,
	isDragging,
}: BotBuilderAvailableBlocksProps) => {
	return (
		<div className="space-y-6">
			<div>
				<div className="mb-3 flex items-center justify-between">
					<h3 className="font-semibold text-muted-foreground text-xs uppercase">
						Template Blocks
					</h3>
					<Badge variant="outline" className="text-xs">
						{templateBlocks.length}
					</Badge>
				</div>
				<DroppableZone
					id={DROP_ZONE_IDS.availableTemplate}
					dragging={isDragging}
					emptyContent={
						<p className="text-muted-foreground text-sm">
							No templates available
						</p>
					}
					isEmpty={!templateBlocks.length}
				>
					{templateBlocks.length ? (
						<div className="space-y-2">
							{templateBlocks.map((block) => (
								<DraggableBlock key={block.id} block={block} />
							))}
						</div>
					) : null}
				</DroppableZone>
			</div>
			<div>
				<div className="mb-3 flex items-center justify-between">
					<h3 className="font-semibold text-muted-foreground text-xs uppercase">
						Database Blocks
					</h3>
					<Badge variant="outline" className="text-xs">
						{databaseBlocks.length}
					</Badge>
				</div>
				<DroppableZone
					id={DROP_ZONE_IDS.availableDatabase}
					dragging={isDragging}
					emptyContent={
						<p className="text-muted-foreground text-sm">
							No database blocks available
						</p>
					}
					isEmpty={!databaseBlocks.length}
				>
					{databaseBlocks.length ? (
						<div className="space-y-2">
							{databaseBlocks.map((block) => (
								<DraggableBlock key={block.id} block={block} />
							))}
						</div>
					) : null}
				</DroppableZone>
			</div>
		</div>
	);
};

export { BotBuilderAvailableBlocks };
