import { assetIdSchema } from "@orcai/schema";
import { Trash2Icon } from "lucide-react";
import { z } from "zod/v4";
import { batchSummary, declareTool } from "@/lib/ai/tools/declaration";
import { m } from "@/paraglide/messages";
import { CONTENT_CAPABILITIES } from "../capabilities";
import type { deleteAssetTool } from "./delete-asset";

export const deleteAssetInputSchema = z.strictObject({
	ids: z
		.array(assetIdSchema)
		.min(1)
		.max(20)
		.describe("Ids of the assets to delete, from findAssets."),
});

export const deleteAsset = declareTool<typeof deleteAssetTool>()({
	kind: "change",
	group: "bots",
	capabilities: CONTENT_CAPABILITIES,
	confirm: "delete",
	inputSchema: deleteAssetInputSchema,
	icon: Trash2Icon,
	name: () => m.assistant_tool_delete_asset_name(),
	active: () => m.assistant_tool_delete_asset_active(),
	...batchSummary<typeof deleteAssetTool>({
		kind: "asset",
		ids: (input) => input?.ids,
		named: (output) => [
			...output.deleted,
			...output.skipped,
		],
		summary: m.assistant_tool_delete_asset_summary,
	}),
});
