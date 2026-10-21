import { BookMarkedIcon } from "lucide-react";
import { declareTool } from "@/lib/ai/tools/declaration";
import { m } from "@/paraglide/messages";
import type { getKnowledgeBasePageTool } from "./get-knowledge-base-page";

export const getKnowledgeBasePage = declareTool<
	typeof getKnowledgeBasePageTool
>()({
	kind: "read",
	icon: BookMarkedIcon,
	name: m.chat_work_log_tool_get_page_name,
	active: m.chat_work_log_tool_get_page_active,
});
