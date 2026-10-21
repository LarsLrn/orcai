import { LibraryIcon } from "lucide-react";
import { declareTool } from "@/lib/ai/tools/declaration";
import { m } from "@/paraglide/messages";
import type { listKnowledgeBaseDocumentsTool } from "./list-knowledge-base-documents";

export const listKnowledgeBaseDocuments = declareTool<
	typeof listKnowledgeBaseDocumentsTool
>()({
	kind: "read",
	icon: LibraryIcon,
	name: m.chat_work_log_tool_list_documents_name,
	active: m.chat_work_log_tool_list_documents_active,
});
