import { RotateCwIcon } from "lucide-react";
import { declareTool, formatNames } from "@/lib/ai/tools/declaration";
import type { EntityRef } from "@/lib/ai/tools/entity-kind";
import { m } from "@/paraglide/messages";
import { CONTENT_CAPABILITIES } from "../capabilities";
import type { prepareAssetAgainTool } from "./prepare-asset-again";

export const prepareAssetAgain = declareTool<typeof prepareAssetAgainTool>()({
	kind: "change",
	group: "bots",
	capabilities: CONTENT_CAPABILITIES,
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
