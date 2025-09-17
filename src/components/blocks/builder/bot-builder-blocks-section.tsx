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
import type { Block } from "@/lib/orpc/schemas/block";
import { DROP_ZONE_IDS, MAX_DATABASE_BLOCKS } from "@/settings/bots";
import type { BotBuilderFormValues } from "./bot-builder-form.types";

interface BotBuilderBlocksSectionProps {
	form: UseFormReturn<BotBuilderFormValues>;
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

	const { templateId, databaseIds, unknownIds } = useMemo(() => {
		let template: string | undefined;
		const database: string[] = [];
		const unknown: string[] = [];

		blockIds.forEach((id) => {
			const block = blockMap.get(id);
			if (!block) {
				unknown.push(id);
				return;
			}

			if (block.type === "template" && !template) {
				template = block.id;
				return;
			}

			if (block.type === "database") {
				if (!database.includes(block.id)) {
					database.push(block.id);
				}
				return;
			}

			unknown.push(id);
		});

		return { templateId: template, databaseIds: database, unknownIds: unknown };
	}, [blockIds, blockMap]);

	const templateBlock = templateId ? blockMap.get(templateId) : undefined;
	const databaseBlocks = useMemo(() => {
		return databaseIds
			.map((id) => blockMap.get(id))
			.filter((block): block is Block => Boolean(block));
	}, [databaseIds, blockMap]);

	const templateBlocksAvailable = useMemo(() => {
		return blocks.filter(
			(block) => block.type === "template" && block.id !== templateId,
		);
	}, [blocks, templateId]);

	const databaseBlocksAvailable = useMemo(() => {
		return blocks.filter((block) => {
			return block.type === "database" && !databaseIds.includes(block.id);
		});
	}, [blocks, databaseIds]);

	const updateBlockIds = useCallback(
		(nextIds: string[]) => {
			const deduped = nextIds.filter(
				(id, index) => nextIds.indexOf(id) === index,
			);
			form.setValue("blockIds", deduped, {
				shouldDirty: true,
				shouldTouch: true,
				shouldValidate: true,
			});
		},
		[form],
	);

	const assignTemplateBlock = useCallback(
		(block: Block) => {
			if (block.type !== "template") {
				toast.error("Only template blocks can occupy the template slot.");
				return;
			}

			if (templateId === block.id) {
				return;
			}

			const filteredDatabase = databaseIds.filter((id) => id !== block.id);
			const filteredUnknown = unknownIds.filter((id) => id !== block.id);
			updateBlockIds([block.id, ...filteredDatabase, ...filteredUnknown]);
		},
		[databaseIds, templateId, unknownIds, updateBlockIds],
	);

	const addDatabaseBlock = useCallback(
		(block: Block) => {
			if (block.type !== "database") {
				toast.error("Only database blocks can be added to the knowledge slot.");
				return;
			}

			if (databaseIds.includes(block.id)) {
				return;
			}

			if (databaseIds.length >= MAX_DATABASE_BLOCKS) {
				toast.error(
					`You can only add up to ${MAX_DATABASE_BLOCKS} database blocks.`,
				);
				return;
			}

			const filteredUnknown = unknownIds.filter((id) => id !== block.id);
			const filteredDatabase = databaseIds.filter((id) => id !== block.id);
			const prefix = templateId ? [templateId] : [];
			updateBlockIds([
				...prefix,
				...filteredDatabase,
				block.id,
				...filteredUnknown,
			]);
		},
		[databaseIds, templateId, unknownIds, updateBlockIds],
	);

	const removeBlock = useCallback(
		(blockId: string) => {
			const nextTemplate = templateId === blockId ? undefined : templateId;
			const filteredDatabase = databaseIds.filter((id) => id !== blockId);
			const filteredUnknown = unknownIds.filter((id) => id !== blockId);
			const nextIds = [
				...(nextTemplate ? [nextTemplate] : []),
				...filteredDatabase,
				...filteredUnknown,
			];
			updateBlockIds(nextIds);
		},
		[databaseIds, templateId, unknownIds, updateBlockIds],
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

			if (over.id === DROP_ZONE_IDS.activeTemplate) {
				assignTemplateBlock(block);
				return;
			}

			if (over.id === DROP_ZONE_IDS.activeDatabase) {
				addDatabaseBlock(block);
				return;
			}

			if (
				over.id === DROP_ZONE_IDS.availableTemplate ||
				over.id === DROP_ZONE_IDS.availableDatabase
			) {
				removeBlock(block.id);
			}
		},
		[addDatabaseBlock, assignTemplateBlock, blockMap, removeBlock],
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
							templateBlocks={templateBlocksAvailable}
							databaseBlocks={databaseBlocksAvailable}
							isDragging={isDragging}
						/>
						<BotBuilderActiveBlocks
							templateBlock={templateBlock}
							databaseBlocks={databaseBlocks}
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
