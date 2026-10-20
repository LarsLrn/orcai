import { Trash2Icon } from "lucide-react";
import { m } from "@/paraglide/messages";
import { defineBatchSummary } from "../summary";

export const deleteAssetSummary = defineBatchSummary<"deleteAsset">({
	icon: Trash2Icon,
	name: () => m.assistant_tool_delete_asset_name(),
	active: () => m.assistant_tool_delete_asset_active(),
	kind: "asset",
	ids: (input) => input?.ids,
	named: (output) => [
		...output.deleted,
		...output.skipped,
	],
	summary: m.assistant_tool_delete_asset_summary,
	verb: "delete",
});
