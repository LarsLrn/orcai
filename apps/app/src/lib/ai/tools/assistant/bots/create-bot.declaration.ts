import { BotIcon } from "lucide-react";
import { declareTool, formatNames } from "@/lib/ai/tools/declaration";
import { m } from "@/paraglide/messages";
import { CONTENT_CAPABILITIES } from "../capabilities";
import type { createBotTool } from "./create-bot";

export const createBot = declareTool<typeof createBotTool>()({
	kind: "create",
	group: "bots",
	capabilities: CONTENT_CAPABILITIES,
	icon: BotIcon,
	name: () => m.assistant_tool_create_bot_name(),
	active: () => m.assistant_tool_create_bot_active(),
	line: ({ input, output }) => {
		const name = output ? output.name : input?.name;

		return name
			? m.assistant_tool_create_bot_summary({
					name: formatNames([
						name,
					]),
				})
			: m.assistant_tool_create_bot_name();
	},
});
