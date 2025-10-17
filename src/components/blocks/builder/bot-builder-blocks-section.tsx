import { DndContext, type DragEndEvent } from "@dnd-kit/core";
import { useCallback, useMemo, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import { BotBuilderActiveBlocks } from "@/components/blocks/builder/bot-builder-active-blocks";
import { BotBuilderAvailableBlocks } from "@/components/blocks/builder/bot-builder-available-blocks";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import type { Block, BlockType } from "@/lib/orpc/schemas/block";
import type { BotInsert } from "@/lib/orpc/schemas/bot";
import { BLOCK_TYPE_CONFIGS } from "./bot-builder-config";

interface BotBuilderBlocksSectionProps {
	form: UseFormReturn<BotInsert>;
	blocks: Block[];
}

const BotBuilderBlocksSection = ({
	form,
	blocks,
}: BotBuilderBlocksSectionProps) => {
	const [isDragging, setIsDragging] = useState(false);
	const blockIds = form.watch("blockIds") ?? [];

	const blockMap = useMemo(() => {
		return new Map(blocks.map((block) => [block.id, block] as const));
	}, [blocks]);

	// Group blocks by type
	const blocksByType = useMemo(() => {
		const grouped: Record<string, string[]> = {};
		const unknown: string[] = [];

		for (const id of blockIds) {
			const block = blockMap.get(id);
			if (!block) {
				unknown.push(id);
				continue;
			}

			const config = BLOCK_TYPE_CONFIGS.find((c) => c.type === block.type);
			if (!config) {
				unknown.push(id);
				continue;
			}

			if (!grouped[block.type]) {
				grouped[block.type] = [];
			}

			const maxCount = config.maxCount;
			if (grouped[block.type].length < maxCount) {
				grouped[block.type].push(id);
			}
		}

		return { grouped, unknown };
	}, [blockIds, blockMap]);

	// Get active blocks for each type
	const activeBlocks = useMemo(() => {
		const result: Record<string, Block[]> = {};
		for (const [type, ids] of Object.entries(blocksByType.grouped)) {
			result[type] = ids
				.map((id) => blockMap.get(id))
				.filter((block): block is Block => Boolean(block));
		}
		return result;
	}, [blocksByType.grouped, blockMap]);

	// Get available (unused) blocks for each type
	const availableBlocks = useMemo(() => {
		const result: Record<string, Block[]> = {};
		const activeIds = new Set(blockIds);

		for (const config of BLOCK_TYPE_CONFIGS) {
			result[config.type] = blocks.filter(
				(block) => block.type === config.type && !activeIds.has(block.id),
			);
		}
		return result;
	}, [blocks, blockIds]);

	const updateBlockIds = useCallback(
		(nextIds: string[]) => {
			const deduped = Array.from(new Set(nextIds));
			form.setValue("blockIds", deduped, {
				shouldDirty: true,
				shouldTouch: true,
				shouldValidate: true,
			});
		},
		[form],
	);

	const assignBlock = useCallback(
		(block: Block, targetType: BlockType) => {
			const config = BLOCK_TYPE_CONFIGS.find((c) => c.type === targetType);
			if (!config) {
				return;
			}

			if (block.type !== targetType) {
				toast.error(
					`Only ${config.label} blocks can be assigned to this slot.`,
				);
				return;
			}

			const currentIds = blocksByType.grouped[targetType] || [];

			// Already assigned
			if (currentIds.includes(block.id)) {
				return;
			}

			// Check max count
			if (currentIds.length >= config.maxCount) {
				if (config.maxCount === 1) {
					// Replace single block
					const nextIds = blockIds.filter((id) => !currentIds.includes(id));
					updateBlockIds([...nextIds, block.id]);
				} else {
					toast.error(
						`You can only add up to ${config.maxCount} ${config.label} blocks.`,
					);
				}
				return;
			}

			// Add block (remove from other locations first)
			const nextIds = blockIds.filter((id) => id !== block.id);
			updateBlockIds([...nextIds, block.id]);
		},
		[blockIds, blocksByType.grouped, updateBlockIds],
	);

	const removeBlock = useCallback(
		(blockId: string) => {
			updateBlockIds(blockIds.filter((id) => id !== blockId));
		},
		[blockIds, updateBlockIds],
	);

	const handleDragEnd = useCallback(
		(event: DragEndEvent) => {
			setIsDragging(false);
			const { active, over } = event;
			if (!over) {
				return;
			}

			const block = blockMap.get(String(active.id));
			if (!block) {
				return;
			}

			// Build drop zone map dynamically from config
			const dropZoneMap: Record<string, BlockType | null> = {};
			for (const config of BLOCK_TYPE_CONFIGS) {
				dropZoneMap[config.activeDropZoneId] = config.type;
				dropZoneMap[config.availableDropZoneId] = null;
			}

			const targetType = dropZoneMap[String(over.id)];

			if (targetType) {
				assignBlock(block, targetType);
			} else if (targetType === null) {
				removeBlock(block.id);
			}
		},
		[assignBlock, blockMap, removeBlock],
	);

	return (
		<Card>
			<CardHeader>
				<CardTitle>Block Configuration</CardTitle>
				<CardDescription>
					Drag and drop blocks into the appropriate slots to craft your bot's
					behavior
				</CardDescription>
			</CardHeader>
			<CardContent>
				<DndContext
					onDragStart={() => setIsDragging(true)}
					onDragEnd={handleDragEnd}
					onDragCancel={() => setIsDragging(false)}
				>
					<div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
						<BotBuilderAvailableBlocks
							blocksByType={availableBlocks}
							isDragging={isDragging}
						/>
						<BotBuilderActiveBlocks
							blocksByType={activeBlocks}
							isDragging={isDragging}
							onRemoveBlock={removeBlock}
						/>
					</div>
				</DndContext>
			</CardContent>
		</Card>
	);
};

export { BotBuilderBlocksSection };
