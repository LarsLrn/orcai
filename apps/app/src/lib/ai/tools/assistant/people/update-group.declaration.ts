import { UsersIcon } from "lucide-react";
import { declareTool, formatNames } from "@/lib/ai/tools/declaration";
import { m } from "@/paraglide/messages";
import type { updateGroupTool } from "./update-group";

export const updateGroup = declareTool<typeof updateGroupTool>()({
	kind: "change",
	group: "people",
	capabilities: [
		"manage_groups",
	],
	icon: UsersIcon,
	name: () => m.assistant_tool_update_group_name(),
	active: () => m.assistant_tool_update_group_active(),
	refs: ({ input, output }) =>
		!output && input && !input.name
			? [
					{
						kind: "group",
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
						kind: "group",
						id: input.id,
					}));

		return name === undefined
			? m.assistant_tool_update_group_name()
			: m.assistant_tool_update_group_summary({
					name: formatNames([
						name,
					]),
				});
	},
});
