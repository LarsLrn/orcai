import { BotIcon } from "lucide-react";
import { declareTool } from "@/lib/ai/tools/declaration";
import { m } from "@/paraglide/messages";
import type { getBotTool } from "./get-bot";

export const getBot = declareTool<typeof getBotTool>()({
	kind: "read",
	group: "core",
	icon: BotIcon,
	name: () => m.assistant_tool_get_bot_name(),
	active: () => m.assistant_tool_get_bot_active(),
	refs: ({ input, output }) =>
		output || !input
			? []
			: [
					{
						kind: "bot",
						id: input.id,
					},
				],
	line: ({ input, output }, nameOf) => {
		const name = output
			? output.name
			: input
				? nameOf({
						kind: "bot",
						id: input.id,
					})
				: undefined;

		return name === undefined
			? m.assistant_tool_get_bot_name()
			: m.assistant_tool_get_bot_summary({
					name: m.assistant_tool_quoted_name({
						name,
					}),
				});
	},
});
