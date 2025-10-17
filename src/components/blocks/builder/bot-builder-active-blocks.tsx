import { Badge } from "@/components/ui/badge";
import type { Block } from "@/lib/orpc/schemas/block";
import { BotBuilderActiveBlockItem } from "./bot-builder-active-block-item";
import { BLOCK_TYPE_CONFIGS } from "./bot-builder-config";
import { DroppableZone } from "./droppable-zone";

interface BotBuilderActiveBlocksProps {
	blocksByType: Record<string, Block[]>;
	isDragging: boolean;
	onRemoveBlock: (blockId: string) => void;
}

const BotBuilderActiveBlocks = ({
	blocksByType,
	isDragging,
	onRemoveBlock,
}: BotBuilderActiveBlocksProps) => {
	return (
		<div className="space-y-6">
			{BLOCK_TYPE_CONFIGS.map((config) => {
				const blocks = blocksByType[config.type] || [];
				const Icon = config.icon;
				const badgeLabel = config.badgeLabel
					? config.badgeLabel(blocks.length, config.maxCount)
					: `${blocks.length} / ${config.maxCount}`;

				return (
					<div key={config.type}>
						<div className="mb-3 flex items-center gap-2">
							<Icon className="size-4 text-primary" />
							<h3 className="font-semibold text-sm">{config.activeLabel}</h3>
							<div className="ml-auto">
								<Badge variant="outline" className="text-xs">
									{badgeLabel}
								</Badge>
							</div>
						</div>
						<DroppableZone
							id={config.activeDropZoneId}
							dragging={isDragging}
							emptyContent={
								<p className="text-muted-foreground text-sm">
									{config.emptyActiveMessage}
								</p>
							}
							isEmpty={!blocks.length}
						>
							{blocks.length ? (
								<div className="space-y-2">
									{blocks.map((block) => (
										<BotBuilderActiveBlockItem
											key={block.id}
											block={block}
											onRemove={onRemoveBlock}
										/>
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

export { BotBuilderActiveBlocks };
