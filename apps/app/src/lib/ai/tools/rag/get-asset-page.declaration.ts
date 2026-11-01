import { BookMarkedIcon } from "lucide-react";
import { declareTool } from "@/lib/ai/tools/declaration";
import { m } from "@/paraglide/messages";
import type { getAssetPageTool } from "./get-asset-page";
import { pageOutputSchema, passageSources } from "./outputs";

export const getAssetPage = declareTool<typeof getAssetPageTool>()({
	kind: "read",
	icon: BookMarkedIcon,
	name: m.chat_work_log_tool_get_page_name,
	active: m.chat_work_log_tool_get_page_active,
	sources: (output) =>
		passageSources(pageOutputSchema.safeParse(output).data?.passages ?? []),
});
