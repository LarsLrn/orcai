import { PackagePlusIcon } from "lucide-react";
import { declareTool } from "@/lib/ai/tools/declaration";
import { m } from "@/paraglide/messages";
import type { installFromCatalogueTool } from "./install-from-catalogue";

export const installFromCatalogue = declareTool<
	typeof installFromCatalogueTool
>()({
	kind: "change",
	group: "bots",
	capabilities: [
		"install_resource",
	],
	confirm: "add",
	icon: PackagePlusIcon,
	name: () => m.assistant_tool_install_from_catalogue_name(),
	active: () => m.assistant_tool_install_from_catalogue_active(),
	refs: ({ input, output }) =>
		!output && input
			? [
					{
						kind: input.entry.resourceType,
						id: input.entry.resourceId,
					},
				]
			: [],
	line: ({ input, output }, nameOf) => {
		if (!input) return m.assistant_tool_install_from_catalogue_name();
		const name = m.assistant_tool_quoted_name({
			name:
				output?.name ??
				nameOf({
					kind: input.entry.resourceType,
					id: input.entry.resourceId,
				}),
		});
		return input.withBlocks && input.entry.resourceType === "bot"
			? m.assistant_tool_install_from_catalogue_with_blocks_summary({
					name,
				})
			: m.assistant_tool_install_from_catalogue_summary({
					name,
				});
	},
});
