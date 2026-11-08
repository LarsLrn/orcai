import { GlobeIcon } from "lucide-react";
import { z } from "zod/v4";
import { declareTool } from "@/lib/ai/tools/declaration";
import { m } from "@/paraglide/messages";
import { webSources } from "./outputs";
import type { searchWebTool } from "./search-web";

export const searchWebInputSchema = z.strictObject({
	query: z
		.string()
		.trim()
		.min(2)
		.max(400)
		.describe("What to search for, as you would type it into a search engine."),
});

export const searchWeb = declareTool<typeof searchWebTool>()({
	kind: "read",
	inputSchema: searchWebInputSchema,
	icon: GlobeIcon,
	name: m.chat_work_log_tool_web_search_name,
	active: m.chat_work_log_tool_web_search_active,
	sources: webSources,
});
