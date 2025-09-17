import { DatabaseIcon, SparklesIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Block } from "@/lib/orpc/schemas/block";
import { DROP_ZONE_IDS, MAX_DATABASE_BLOCKS } from "@/settings/bots";
import { BotBuilderActiveBlockItem } from "./bot-builder-active-block-item";
import { DroppableZone } from "./droppable-zone";

interface BotBuilderActiveBlocksProps {
	templateBlock?: Block;
	databaseBlocks: Block[];
	isDragging: boolean;
	onRemoveBlock: (blockId: string) => void;
}

const BotBuilderActiveBlocks = ({
	templateBlock,
	databaseBlocks,
	isDragging,
	onRemoveBlock,
}: BotBuilderActiveBlocksProps) => {
	return (
		<div className="space-y-6">
			<div>
				<div className="mb-3 flex items-center gap-2">
					<SparklesIcon className="size-4 text-primary" />
					<h3 className="font-semibold text-sm">Template</h3>
					<div className="ml-auto">
						<Badge variant="outline" className="text-xs">
							{templateBlock ? "Selected" : "Required"}
						</Badge>
					</div>
				</div>
				<DroppableZone
					id={DROP_ZONE_IDS.activeTemplate}
					dragging={isDragging}
					emptyContent={
						<p className="text-muted-foreground text-sm">
							Assign one template block to define your bot's voice
						</p>
					}
					isEmpty={!templateBlock}
				>
					{templateBlock ? (
						<BotBuilderActiveBlockItem
							block={templateBlock}
							onRemove={onRemoveBlock}
						/>
					) : null}
				</DroppableZone>
			</div>
			<div>
				<div className="mb-3 flex items-center gap-2">
					<DatabaseIcon className="size-4 text-primary" />
					<h3 className="font-semibold text-sm">Knowledge Sources</h3>
					<div className="ml-auto">
						<Badge variant="outline" className="text-xs">
							{databaseBlocks.length} / {MAX_DATABASE_BLOCKS}
						</Badge>
					</div>
				</div>
				<DroppableZone
					id={DROP_ZONE_IDS.activeDatabase}
					dragging={isDragging}
					emptyContent={
						<p className="text-muted-foreground text-sm">
							Include up to {MAX_DATABASE_BLOCKS} database blocks to ground your
							bot with knowledge
						</p>
					}
					isEmpty={!databaseBlocks.length}
				>
					{databaseBlocks.length ? (
						<div className="space-y-2">
							{databaseBlocks.map((block) => (
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
		</div>
	);
};

export { BotBuilderActiveBlocks };
