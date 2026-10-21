import { Trash2Icon } from "lucide-react";
import { batchSummary, declareTool } from "@/lib/ai/tools/declaration";
import { m } from "@/paraglide/messages";
import type { deleteGroupTool } from "./delete-group";

export const deleteGroup = declareTool<typeof deleteGroupTool>()({
	kind: "change",
	group: "people",
	capabilities: [
		"manage_groups",
	],
	confirm: "delete",
	icon: Trash2Icon,
	name: () => m.assistant_tool_delete_group_name(),
	active: () => m.assistant_tool_delete_group_active(),
	...batchSummary<typeof deleteGroupTool>({
		kind: "group",
		ids: (input) => input?.ids,
		named: (output) => output.deleted,
		summary: m.assistant_tool_delete_group_summary,
	}),
});
