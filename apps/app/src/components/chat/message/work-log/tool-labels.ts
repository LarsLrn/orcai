import {
	BookMarkedIcon,
	FileTextIcon,
	Grid3x3Icon,
	LibraryIcon,
	ListChecksIcon,
	type LucideIcon,
	SearchIcon,
	SpellCheckIcon,
	WrenchIcon,
} from "lucide-react";
import type { ToolPart } from "@/components/chat/message/classify-turn";
import { m } from "@/paraglide/messages";

export interface ToolLabels {
	/** Fallback entry label when the renderer has no outcome to report. */
	name: string;
	active: string;
	icon: LucideIcon;
}

type KnownToolType = Extract<ToolPart["type"], `tool-${string}`>;

const knownToolLabels: Record<KnownToolType, () => ToolLabels> = {
	"tool-getKnowledgeBaseChunks": () => ({
		name: m.chat_work_log_tool_get_chunks_name(),
		active: m.chat_work_log_tool_get_chunks_active(),
		icon: FileTextIcon,
	}),
	"tool-getKnowledgeBasePage": () => ({
		name: m.chat_work_log_tool_get_page_name(),
		active: m.chat_work_log_tool_get_page_active(),
		icon: BookMarkedIcon,
	}),
	"tool-listKnowledgeBaseDocuments": () => ({
		name: m.chat_work_log_tool_list_documents_name(),
		active: m.chat_work_log_tool_list_documents_active(),
		icon: LibraryIcon,
	}),
	"tool-searchKnowledgeBase": () => ({
		name: m.chat_work_log_tool_search_name(),
		active: m.chat_work_log_tool_search_active(),
		icon: SearchIcon,
	}),
	"tool-showChecklist": () => ({
		name: m.chat_work_log_tool_show_checklist_name(),
		active: m.chat_work_log_tool_show_checklist_active(),
		icon: ListChecksIcon,
	}),
	"tool-showReview": () => ({
		name: m.chat_work_log_tool_show_review_name(),
		active: m.chat_work_log_tool_show_review_active(),
		icon: SpellCheckIcon,
	}),
	"tool-showMatrix": () => ({
		name: m.chat_work_log_tool_show_matrix_name(),
		active: m.chat_work_log_tool_show_matrix_active(),
		icon: Grid3x3Icon,
	}),
};

const isKnownToolType = (type: string): type is KnownToolType =>
	type in knownToolLabels;

/** Stored parts outlive the tool set, so unknown types fall back gracefully. */
export const toolLabels = (part: ToolPart): ToolLabels => {
	if (part.type === "dynamic-tool") {
		return {
			name: part.toolName,
			active: m.chat_work_log_tool_generic_active({
				tool: part.toolName,
			}),
			icon: WrenchIcon,
		};
	}

	const type: string = part.type;

	if (isKnownToolType(type)) {
		return knownToolLabels[type]();
	}

	const name = type.replace(/^tool-/, "");

	return {
		name,
		active: m.chat_work_log_tool_generic_active({
			tool: name,
		}),
		icon: WrenchIcon,
	};
};
