import { Trash2Icon } from "lucide-react";
import { m } from "@/paraglide/messages";
import { defineBatchSummary } from "../summary";

export const deleteBotSummary = defineBatchSummary<"deleteBot">({
	icon: Trash2Icon,
	name: () => m.assistant_tool_delete_bot_name(),
	active: () => m.assistant_tool_delete_bot_active(),
	kind: "bot",
	ids: (input) => input?.ids,
	named: (output) => [
		...output.deleted,
		...output.skipped,
	],
	summary: m.assistant_tool_delete_bot_summary,
	verb: "delete",
});
