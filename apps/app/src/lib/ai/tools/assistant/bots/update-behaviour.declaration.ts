import { ScrollTextIcon } from "lucide-react";
import { batchSummary, declareTool } from "@/lib/ai/tools/declaration";
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
	...batchSummary<typeof updateBehaviourTool>({
		kind: "behaviour",
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
		summary: m.assistant_tool_update_behaviour_summary,
	}),
	written: ({ id, name }) => ({
		kind: "behaviour",
		id,
		name,
	}),
});
