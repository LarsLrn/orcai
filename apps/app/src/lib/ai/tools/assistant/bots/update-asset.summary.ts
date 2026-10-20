import { FilePenIcon } from "lucide-react";
import { m } from "@/paraglide/messages";
import { defineToolSummary, formatNames } from "../summary";

export const updateAssetSummary = defineToolSummary<"updateAsset">({
	icon: FilePenIcon,
	name: () => m.assistant_tool_update_asset_name(),
	active: () => m.assistant_tool_update_asset_active(),
	refs: (part) =>
		part.state !== "output-available" && part.input && !part.input.title
			? [
					{
						kind: "asset",
						id: part.input.id,
					},
				]
			: [],
	line: (part, nameOf) => {
		const name =
			part.state === "output-available"
				? part.output.title
				: part.input &&
					(part.input.title ??
						nameOf({
							kind: "asset",
							id: part.input.id,
						}));

		return name === undefined
			? m.assistant_tool_update_asset_name()
			: m.assistant_tool_update_asset_summary({
					name: formatNames([
						name,
					]),
				});
	},
});
