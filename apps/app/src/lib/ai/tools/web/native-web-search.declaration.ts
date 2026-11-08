import type { Tool } from "ai";
import { GlobeIcon } from "lucide-react";
import { z } from "zod/v4";
import { declareTool } from "@/lib/ai/tools/declaration";
import { m } from "@/paraglide/messages";

/** The model provider's own search, which runs on the provider's side. */
export const nativeWebSearch = declareTool<Tool>()({
	kind: "read",
	inputSchema: z.looseObject({}),
	icon: GlobeIcon,
	name: m.chat_work_log_tool_web_search_name,
	active: m.chat_work_log_tool_web_search_active,
});
