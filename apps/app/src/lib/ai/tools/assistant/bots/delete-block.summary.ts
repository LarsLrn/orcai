import { Trash2Icon } from "lucide-react";
import { m } from "@/paraglide/messages";
import { defineBatchSummary } from "../summary";

export const deleteBlockSummary = defineBatchSummary<"deleteBlock">({
	icon: Trash2Icon,
	name: () => m.assistant_tool_delete_block_name(),
	active: () => m.assistant_tool_delete_block_active(),
	kind: "block",
	ids: (input) => input?.ids,
	named: (output) => [
		...output.deleted,
		...output.skipped,
	],
	summary: m.assistant_tool_delete_block_summary,
	verb: "delete",
});
