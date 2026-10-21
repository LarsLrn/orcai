import { RocketIcon } from "lucide-react";
import { declareTool, formatNames } from "@/lib/ai/tools/declaration";
import { m } from "@/paraglide/messages";
import { CONTENT_CAPABILITIES } from "../capabilities";
import type { publishBotTool } from "./publish-bot";

export const publishBot = declareTool<typeof publishBotTool>()({
	kind: "change",
	group: "bots",
	capabilities: CONTENT_CAPABILITIES,
	icon: RocketIcon,
	name: () => m.assistant_tool_publish_bot_name(),
	active: () => m.assistant_tool_publish_bot_active(),
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
			: input &&
				nameOf({
					kind: "bot",
					id: input.id,
				});

		return name === undefined
			? m.assistant_tool_publish_bot_name()
			: m.assistant_tool_publish_bot_summary({
					name: formatNames([
						name,
					]),
				});
	},
});
