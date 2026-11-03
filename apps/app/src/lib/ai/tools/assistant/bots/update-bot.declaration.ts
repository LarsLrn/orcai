import { BotIcon } from "lucide-react";
import { batchSummary, declareTool } from "@/lib/ai/tools/declaration";
import { m } from "@/paraglide/messages";
import { CONTENT_CAPABILITIES } from "../capabilities";
import type { updateBotTool } from "./update-bot";

export const updateBot = declareTool<typeof updateBotTool>()({
	kind: "change",
	group: "bots",
	capabilities: CONTENT_CAPABILITIES,
	icon: BotIcon,
	name: () => m.assistant_tool_update_bot_name(),
	active: () => m.assistant_tool_update_bot_active(),
	...batchSummary<typeof updateBotTool>({
		kind: "bot",
		ids: (input) =>
			input && [
				input.id,
			],
		pendingName: (input) => input.name,
		named: (output) => [
			{
				id: output.id,
				name: output.name,
			},
		],
		summary: m.assistant_tool_update_bot_summary,
	}),
	written: ({ id, name }) => ({
		kind: "bot",
		id,
		name,
	}),
});
