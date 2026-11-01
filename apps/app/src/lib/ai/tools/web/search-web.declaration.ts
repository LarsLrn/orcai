import { GlobeIcon } from "lucide-react";
import { declareTool } from "@/lib/ai/tools/declaration";
import { m } from "@/paraglide/messages";
import { webSources } from "./outputs";
import type { searchWebTool } from "./search-web";

export const searchWeb = declareTool<typeof searchWebTool>()({
	kind: "read",
	icon: GlobeIcon,
	name: m.chat_work_log_tool_web_search_name,
	active: m.chat_work_log_tool_web_search_active,
	sources: webSources,
});
