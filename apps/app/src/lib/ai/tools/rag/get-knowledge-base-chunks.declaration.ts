import { FileTextIcon } from "lucide-react";
import { declareTool } from "@/lib/ai/tools/declaration";
import { m } from "@/paraglide/messages";
import type { getKnowledgeBaseChunksTool } from "./get-knowledge-base-chunk";

export const getKnowledgeBaseChunks = declareTool<
	typeof getKnowledgeBaseChunksTool
>()({
	kind: "read",
	icon: FileTextIcon,
	name: m.chat_work_log_tool_get_chunks_name,
	active: m.chat_work_log_tool_get_chunks_active,
});
