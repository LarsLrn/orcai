import {
	BookMarkedIcon,
	FileTextIcon,
	LibraryIcon,
	type LucideIcon,
	SearchIcon,
	WrenchIcon,
} from "lucide-react";
import type { ToolPart } from "@/components/chat/message/classify-turn";

export interface ToolLabels {
	/** Fallback entry label when the renderer has no outcome to report. */
	name: string;
	active: string;
	icon: LucideIcon;
}

type KnownToolType = Extract<ToolPart["type"], `tool-${string}`>;

const knownToolLabels: Record<KnownToolType, ToolLabels> = {
	"tool-getKnowledgeBaseChunks": {
		name: "Read the passages",
		active: "Reading passages",
		icon: FileTextIcon,
	},
	"tool-getKnowledgeBasePage": {
		name: "Read a page",
		active: "Reading a page",
		icon: BookMarkedIcon,
	},
	"tool-listKnowledgeBaseDocuments": {
		name: "Listed the available sources",
		active: "Listing the sources",
		icon: LibraryIcon,
	},
	"tool-searchKnowledgeBase": {
		name: "Searched the sources",
		active: "Searching the sources",
		icon: SearchIcon,
	},
};

const isKnownToolType = (type: string): type is KnownToolType =>
	type in knownToolLabels;

/** Stored parts outlive the tool set, so unknown types fall back gracefully. */
export const toolLabels = (part: ToolPart): ToolLabels => {
	if (part.type === "dynamic-tool") {
		return {
			name: part.toolName,
			active: `Running ${part.toolName}`,
			icon: WrenchIcon,
		};
	}

	const type: string = part.type;

	if (isKnownToolType(type)) {
		return knownToolLabels[type];
	}

	const name = type.replace(/^tool-/, "");

	return {
		name,
		active: `Running ${name}`,
		icon: WrenchIcon,
	};
};
