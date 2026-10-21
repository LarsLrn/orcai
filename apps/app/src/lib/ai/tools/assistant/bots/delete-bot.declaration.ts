import { Trash2Icon } from "lucide-react";
import { batchSummary, declareTool } from "@/lib/ai/tools/declaration";
import { m } from "@/paraglide/messages";
import { CONTENT_CAPABILITIES } from "../capabilities";
import type { deleteBotTool } from "./delete-bot";

export const deleteBot = declareTool<typeof deleteBotTool>()({
	kind: "change",
	group: "bots",
	capabilities: CONTENT_CAPABILITIES,
	confirm: "delete",
	icon: Trash2Icon,
	name: () => m.assistant_tool_delete_bot_name(),
	active: () => m.assistant_tool_delete_bot_active(),
	...batchSummary<typeof deleteBotTool>({
		kind: "bot",
		ids: (input) => input?.ids,
		named: (output) => [
			...output.deleted,
			...output.skipped,
		],
		summary: m.assistant_tool_delete_bot_summary,
	}),
});
