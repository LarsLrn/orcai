import { Trash2Icon } from "lucide-react";
import { m } from "@/paraglide/messages";
import { defineBatchSummary } from "../summary";

export const deleteGroupSummary = defineBatchSummary<"deleteGroup">({
	icon: Trash2Icon,
	name: () => m.assistant_tool_delete_group_name(),
	active: () => m.assistant_tool_delete_group_active(),
	kind: "group",
	ids: (input) => input?.ids,
	named: (output) => output.deleted,
	summary: m.assistant_tool_delete_group_summary,
	verb: "delete",
});
