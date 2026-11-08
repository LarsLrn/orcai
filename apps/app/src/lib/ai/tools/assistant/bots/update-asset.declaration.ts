import {
	assetFieldsSchema,
	assetIdSchema,
	metadataSchema,
} from "@orcai/schema";
import { FilePenIcon } from "lucide-react";
import { z } from "zod/v4";
import { batchSummary, declareTool } from "@/lib/ai/tools/declaration";
import { m } from "@/paraglide/messages";
import { CONTENT_CAPABILITIES } from "../capabilities";
import type { updateAssetTool } from "./update-asset";

const assetMetadataPatchSchema = metadataSchema.partial().strict();

export const updateAssetInputSchema = z.strictObject({
	id: assetIdSchema.describe("Id of the asset, from findAssets."),
	title: assetFieldsSchema.shape.title
		.optional()
		.describe("Leave out to keep the current title."),
	metadata: assetMetadataPatchSchema
		.optional()
		.describe(
			"Only the metadata fields to change; the others keep their values.",
		),
});

export const updateAsset = declareTool<typeof updateAssetTool>()({
	kind: "change",
	group: "bots",
	capabilities: CONTENT_CAPABILITIES,
	inputSchema: updateAssetInputSchema,
	icon: FilePenIcon,
	name: () => m.assistant_tool_update_asset_name(),
	active: () => m.assistant_tool_update_asset_active(),
	...batchSummary<typeof updateAssetTool>({
		kind: "asset",
		ids: (input) =>
			input && [
				input.id,
			],
		pendingName: (input) => input.title,
		named: (output) => [
			{
				id: output.id,
				name: output.title,
			},
		],
		summary: m.assistant_tool_update_asset_summary,
	}),
	written: ({ id, title }) => ({
		kind: "asset",
		id,
		name: title,
	}),
});
