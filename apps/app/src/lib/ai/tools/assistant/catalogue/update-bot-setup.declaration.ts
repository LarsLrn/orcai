import { SlidersHorizontalIcon } from "lucide-react";
import { declareTool } from "@/lib/ai/tools/declaration";
import { m } from "@/paraglide/messages";
import { CATALOGUE_CAPABILITIES } from "../capabilities";
import type { updateBotSetupTool } from "./update-bot-setup";

export const updateBotSetup = declareTool<typeof updateBotSetupTool>()({
	kind: "change",
	group: "bots",
	capabilities: CATALOGUE_CAPABILITIES,
	icon: SlidersHorizontalIcon,
	name: () => m.assistant_tool_update_bot_setup_name(),
	active: () => m.assistant_tool_update_bot_setup_active(),
	refs: ({ input, output }) =>
		!output && input
			? [
					{
						kind: "bot",
						id: input.id,
					},
				]
			: [],
	line: ({ input, output }, nameOf) =>
		input
			? m.assistant_tool_update_bot_setup_summary({
					name: m.assistant_tool_quoted_name({
						name:
							output?.name ??
							nameOf({
								kind: "bot",
								id: input.id,
							}),
					}),
				})
			: m.assistant_tool_update_bot_setup_name(),
});
