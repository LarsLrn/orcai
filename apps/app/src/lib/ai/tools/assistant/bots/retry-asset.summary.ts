import { RotateCwIcon } from "lucide-react";
import { m } from "@/paraglide/messages";
import { defineToolSummary, formatNames, type NameRef } from "../summary";

export const retryAssetSummary = defineToolSummary<"retryAsset">({
	icon: RotateCwIcon,
	name: () => m.assistant_tool_retry_asset_name(),
	active: () => m.assistant_tool_retry_asset_active(),
	refs: (part) =>
		part.input
			? [
					{
						kind: "asset",
						id: part.input.assetId,
					} satisfies NameRef,
					...(part.input.repositoryId
						? [
								{
									kind: "block",
									id: part.input.repositoryId,
								} satisfies NameRef,
							]
						: []),
				]
			: [],
	line: (part, nameOf) => {
		const input = part.input;

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
			? m.assistant_tool_retry_asset_summary_vectorisation({
					asset,
					repository: formatNames([
						nameOf({
							kind: "block",
							id: input.repositoryId,
						}),
					]),
				})
			: m.assistant_tool_retry_asset_summary_processing({
					asset,
				});
	},
});
