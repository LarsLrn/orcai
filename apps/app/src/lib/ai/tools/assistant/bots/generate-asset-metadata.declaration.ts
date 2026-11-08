import { assetIdSchema } from "@orcai/schema";
import { SparklesIcon } from "lucide-react";
import { z } from "zod/v4";
import { declareTool, formatNames } from "@/lib/ai/tools/declaration";
import type { EntityRef } from "@/lib/ai/tools/entity-kind";
import { m } from "@/paraglide/messages";
import { CONTENT_CAPABILITIES } from "../capabilities";
import type { generateAssetMetadataTool } from "./generate-asset-metadata";

const assetRefs = (assetIds: readonly string[] | undefined): EntityRef[] =>
	(assetIds ?? []).map((id) => ({
		kind: "asset",
		id,
	}));

export const generateAssetMetadataInputSchema = z.strictObject({
	assetIds: z
		.array(assetIdSchema)
		.min(1)
		.max(100)
		.describe("Ids of the assets, from findAssets."),
});

export const generateAssetMetadata = declareTool<
	typeof generateAssetMetadataTool
>()({
	kind: "change",
	group: "bots",
	capabilities: CONTENT_CAPABILITIES,
	confirm: "generate",
	inputSchema: generateAssetMetadataInputSchema,
	icon: SparklesIcon,
	name: () => m.assistant_tool_generate_asset_metadata_name(),
	active: () => m.assistant_tool_generate_asset_metadata_active(),
	refs: ({ input }) => assetRefs(input?.assetIds),
	line: ({ input }, nameOf) => {
		const refs = assetRefs(input?.assetIds);

		return refs.length > 0
			? m.assistant_tool_generate_asset_metadata_summary({
					names: formatNames(refs.map(nameOf)),
				})
			: m.assistant_tool_generate_asset_metadata_name();
	},
});
