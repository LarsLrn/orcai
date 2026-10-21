import { RotateCwIcon } from "lucide-react";
import { declareTool, formatNames } from "@/lib/ai/tools/declaration";
import type { EntityRef } from "@/lib/ai/tools/entity-kind";
import { m } from "@/paraglide/messages";
import { CONTENT_CAPABILITIES } from "../capabilities";
import type { retryAssetTool } from "./retry-asset";

export const retryAsset = declareTool<typeof retryAssetTool>()({
	kind: "change",
	group: "bots",
	capabilities: CONTENT_CAPABILITIES,
	icon: RotateCwIcon,
	name: () => m.assistant_tool_retry_asset_name(),
	active: () => m.assistant_tool_retry_asset_active(),
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
			return m.assistant_tool_retry_asset_name();
		}

		const asset = formatNames([
			nameOf({
				kind: "asset",
				id: input.assetId,
			}),
		]);

		return input.repositoryId
			? m.assistant_tool_retry_asset_summary_repository({
					asset,
					repository: formatNames([
						nameOf({
							kind: "repository",
							id: input.repositoryId,
						}),
					]),
				})
			: m.assistant_tool_retry_asset_summary_processing({
					asset,
				});
	},
});
