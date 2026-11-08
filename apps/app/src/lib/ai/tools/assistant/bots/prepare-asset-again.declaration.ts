import { assetIdSchema, blockIdSchema } from "@orcai/schema";
import { RotateCwIcon } from "lucide-react";
import { z } from "zod/v4";
import { declareTool, formatNames } from "@/lib/ai/tools/declaration";
import type { EntityRef } from "@/lib/ai/tools/entity-kind";
import { m } from "@/paraglide/messages";
import { CONTENT_CAPABILITIES } from "../capabilities";
import type { prepareAssetAgainTool } from "./prepare-asset-again";

export const prepareAssetAgainInputSchema = z.strictObject({
	assetId: assetIdSchema.describe("Id of the asset, from findAssets."),
	repositoryId: blockIdSchema
		.optional()
		.describe(
			"The repository to retry the asset in. Leave out to prepare the uploaded file again.",
		),
});

export const prepareAssetAgain = declareTool<typeof prepareAssetAgainTool>()({
	kind: "change",
	group: "bots",
	capabilities: CONTENT_CAPABILITIES,
	inputSchema: prepareAssetAgainInputSchema,
	icon: RotateCwIcon,
	name: () => m.assistant_tool_prepare_asset_again_name(),
	active: () => m.assistant_tool_prepare_asset_again_active(),
	refs: ({ input }) =>
		input
			? [
					{
						kind: "asset",
						id: input.assetId,
					} satisfies EntityRef,
					...(input.repositoryId
						? [
								{
									kind: "repository",
									id: input.repositoryId,
								} satisfies EntityRef,
							]
						: []),
				]
			: [],
	line: ({ input }, nameOf) => {
		if (!input) {
			return m.assistant_tool_prepare_asset_again_name();
		}

		const asset = formatNames([
			nameOf({
				kind: "asset",
				id: input.assetId,
			}),
		]);

		return input.repositoryId
			? m.assistant_tool_prepare_asset_again_summary_repository({
					asset,
					repository: formatNames([
						nameOf({
							kind: "repository",
							id: input.repositoryId,
						}),
					]),
				})
			: m.assistant_tool_prepare_asset_again_summary_processing({
					asset,
				});
	},
});
