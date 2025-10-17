import { DatabaseIcon, ImageIcon, SparklesIcon } from "lucide-react";
import type { BlockType } from "@/lib/orpc/schemas/block";
import { DROP_ZONE_IDS, MAX_DATABASE_BLOCKS } from "@/settings/bots";

export interface BlockTypeConfig {
	type: BlockType;
	maxCount: number;
	label: string;
	activeLabel: string;
	availableLabel: string;
	icon: typeof SparklesIcon;
	activeDropZoneId: string;
	availableDropZoneId: string;
	emptyActiveMessage: string;
	emptyAvailableMessage: string;
	badgeLabel?: (count: number, max: number) => string;
}

// Single source of truth for block type configuration
export const BLOCK_TYPE_CONFIGS: BlockTypeConfig[] = [
	{
		type: "template",
		maxCount: 1,
		label: "template",
		activeLabel: "Template",
		availableLabel: "Template Blocks",
		icon: SparklesIcon,
		activeDropZoneId: DROP_ZONE_IDS.activeTemplate,
		availableDropZoneId: DROP_ZONE_IDS.availableTemplate,
		emptyActiveMessage: "Assign one template block to define your bot's voice",
		emptyAvailableMessage: "No templates available",
		badgeLabel: (count) => (count > 0 ? "Selected" : "Required"),
	},
	{
		type: "imageGeneration",
		maxCount: 1,
		label: "image generation",
		activeLabel: "Image Generation",
		availableLabel: "Image Generation Blocks",
		icon: ImageIcon,
		activeDropZoneId: DROP_ZONE_IDS.activeImageGeneration,
		availableDropZoneId: DROP_ZONE_IDS.availableImageGeneration,
		emptyActiveMessage:
			"Assign an image generation block to enable image creation",
		emptyAvailableMessage: "No image generation blocks available",
		badgeLabel: (count) => (count > 0 ? "Selected" : "Optional"),
	},
	{
		type: "database",
		maxCount: MAX_DATABASE_BLOCKS,
		label: "database",
		activeLabel: "Knowledge Sources",
		availableLabel: "Database Blocks",
		icon: DatabaseIcon,
		activeDropZoneId: DROP_ZONE_IDS.activeDatabase,
		availableDropZoneId: DROP_ZONE_IDS.availableDatabase,
		emptyActiveMessage: `Include up to ${MAX_DATABASE_BLOCKS} database blocks to ground your bot with knowledge`,
		emptyAvailableMessage: "No database blocks available",
		badgeLabel: (count, max) => `${count} / ${max}`,
	},
];
