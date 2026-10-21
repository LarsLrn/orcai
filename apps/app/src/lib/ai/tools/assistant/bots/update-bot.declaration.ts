import { BotIcon } from "lucide-react";
import { declareTool, formatNames } from "@/lib/ai/tools/declaration";
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
	refs: ({ input, output }) =>
		!output && input && !input.name
			? [
					{
						kind: "bot",
						id: input.id,
					},
				]
			: [],
	line: ({ input, output }, nameOf) => {
		const name = output
			? output.name
			: input &&
				(input.name ??
					nameOf({
						kind: "bot",
						id: input.id,
					}));

		return name === undefined
			? m.assistant_tool_update_bot_name()
			: m.assistant_tool_update_bot_summary({
					name: formatNames([
						name,
					]),
				});
	},
});
