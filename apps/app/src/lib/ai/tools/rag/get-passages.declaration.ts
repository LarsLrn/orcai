import { FileTextIcon } from "lucide-react";
import { declareTool } from "@/lib/ai/tools/declaration";
import { m } from "@/paraglide/messages";
import type { getPassagesTool } from "./get-passages";

export const getPassages = declareTool<typeof getPassagesTool>()({
	kind: "read",
	icon: FileTextIcon,
	name: m.chat_work_log_tool_get_chunks_name,
	active: m.chat_work_log_tool_get_chunks_active,
});
