import { UsersIcon } from "lucide-react";
import { batchSummary, declareTool } from "@/lib/ai/tools/declaration";
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
	...batchSummary<typeof updateGroupTool>({
		kind: "group",
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
		summary: m.assistant_tool_update_group_summary,
	}),
});
