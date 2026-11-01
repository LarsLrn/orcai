import { FilePenIcon } from "lucide-react";
import { declareTool, formatNames } from "@/lib/ai/tools/declaration";
import { m } from "@/paraglide/messages";
import { CONTENT_CAPABILITIES } from "../capabilities";
import type { updateAssetTool } from "./update-asset";

export const updateAsset = declareTool<typeof updateAssetTool>()({
	kind: "change",
	group: "bots",
	capabilities: CONTENT_CAPABILITIES,
	icon: FilePenIcon,
	name: () => m.assistant_tool_update_asset_name(),
	active: () => m.assistant_tool_update_asset_active(),
	refs: ({ input, output }) =>
		!output && input && !input.title
			? [
					{
						kind: "asset",
						id: input.id,
					},
				]
			: [],
	line: ({ input, output }, nameOf) => {
		const name = output
			? output.title
			: input &&
				(input.title ??
					nameOf({
						kind: "asset",
						id: input.id,
					}));

		return name === undefined
			? m.assistant_tool_update_asset_name()
			: m.assistant_tool_update_asset_summary({
					name: formatNames([
						name,
					]),
				});
	},
	written: ({ id, title }) => ({
		kind: "asset",
		id,
		name: title,
	}),
});
