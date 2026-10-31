import { ScrollTextIcon } from "lucide-react";
import { declareTool, formatNames } from "@/lib/ai/tools/declaration";
import { m } from "@/paraglide/messages";
import { CONTENT_CAPABILITIES } from "../capabilities";
import type { createBehaviourTool } from "./create-behaviour";

export const createBehaviour = declareTool<typeof createBehaviourTool>()({
	kind: "create",
	group: "bots",
	capabilities: CONTENT_CAPABILITIES,
	icon: ScrollTextIcon,
	name: () => m.assistant_tool_create_behaviour_name(),
	active: () => m.assistant_tool_create_behaviour_active(),
	line: ({ input, output }) => {
		const name = output ? output.name : input?.name;

		return name
			? m.assistant_tool_create_behaviour_summary({
					name: formatNames([
						name,
					]),
				})
			: m.assistant_tool_create_behaviour_name();
	},
});
