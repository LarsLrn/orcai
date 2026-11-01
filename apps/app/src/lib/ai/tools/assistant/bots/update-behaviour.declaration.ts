import { ScrollTextIcon } from "lucide-react";
import { declareTool, formatNames } from "@/lib/ai/tools/declaration";
import { m } from "@/paraglide/messages";
import { CONTENT_CAPABILITIES } from "../capabilities";
import type { updateBehaviourTool } from "./update-behaviour";

export const updateBehaviour = declareTool<typeof updateBehaviourTool>()({
	kind: "change",
	group: "bots",
	capabilities: CONTENT_CAPABILITIES,
	icon: ScrollTextIcon,
	name: () => m.assistant_tool_update_behaviour_name(),
	active: () => m.assistant_tool_update_behaviour_active(),
	refs: ({ input, output }) =>
		!output && input && !input.name
			? [
					{
						kind: "behaviour",
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
						kind: "behaviour",
						id: input.id,
					}));

		return name === undefined
			? m.assistant_tool_update_behaviour_name()
			: m.assistant_tool_update_behaviour_summary({
					name: formatNames([
						name,
					]),
				});
	},
	written: ({ id, name }) => ({
		kind: "behaviour",
		id,
		name,
	}),
});
