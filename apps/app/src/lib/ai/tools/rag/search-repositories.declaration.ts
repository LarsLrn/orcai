import { SearchIcon } from "lucide-react";
import { declareTool } from "@/lib/ai/tools/declaration";
import { m } from "@/paraglide/messages";
import type { searchRepositoriesTool } from "./search-repositories";

export const searchRepositories = declareTool<typeof searchRepositoriesTool>()({
	kind: "read",
	icon: SearchIcon,
	name: m.chat_work_log_tool_search_name,
	active: m.chat_work_log_tool_search_active,
});
