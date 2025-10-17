import { Badge } from "@/components/ui/badge";
import type { Block } from "@/lib/orpc/schemas/block";
import { BLOCK_TYPE_CONFIGS } from "./bot-builder-config";
import { DraggableBlock } from "./draggable-block";
import { DroppableZone } from "./droppable-zone";

interface BotBuilderAvailableBlocksProps {
	blocksByType: Record<string, Block[]>;
	isDragging: boolean;
}

const BotBuilderAvailableBlocks = ({
	blocksByType,
	isDragging,
}: BotBuilderAvailableBlocksProps) => {
	return (
		<div className="space-y-6">
			{BLOCK_TYPE_CONFIGS.map((config) => {
				const blocks = blocksByType[config.type] || [];
				const Icon = config.icon;

				return (
					<div key={config.type}>
						<div className="mb-3 flex items-center justify-between">
							<div className="flex items-center gap-2">
								<Icon className="size-4 text-muted-foreground" />
								<h3 className="font-semibold text-muted-foreground text-xs uppercase">
									{config.availableLabel}
								</h3>
							</div>
							<Badge variant="outline" className="text-xs">
								{blocks.length}
							</Badge>
						</div>
						<DroppableZone
							id={config.availableDropZoneId}
							dragging={isDragging}
							emptyContent={
								<p className="text-muted-foreground text-sm">
									{config.emptyAvailableMessage}
								</p>
							}
							isEmpty={!blocks.length}
						>
							{blocks.length ? (
								<div className="space-y-2">
									{blocks.map((block) => (
										<DraggableBlock key={block.id} block={block} />
									))}
								</div>
							) : null}
						</DroppableZone>
					</div>
				);
			})}
		</div>
	);
};

export { BotBuilderAvailableBlocks };
