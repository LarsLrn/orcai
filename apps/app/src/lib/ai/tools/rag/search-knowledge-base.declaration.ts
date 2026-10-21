import { SearchIcon } from "lucide-react";
import { declareTool } from "@/lib/ai/tools/declaration";
import { m } from "@/paraglide/messages";
import type { searchKnowledgeBaseTool } from "./search-knowledge-base";

export const searchKnowledgeBase = declareTool<
	typeof searchKnowledgeBaseTool
>()({
	kind: "read",
	icon: SearchIcon,
	name: m.chat_work_log_tool_search_name,
	active: m.chat_work_log_tool_search_active,
});
