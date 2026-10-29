import { PackageMinusIcon } from "lucide-react";
import { declareTool } from "@/lib/ai/tools/declaration";
import { m } from "@/paraglide/messages";
import type { uninstallResourceTool } from "./uninstall-resource";

export const uninstallResource = declareTool<typeof uninstallResourceTool>()({
	kind: "change",
	group: "bots",
	capabilities: [
		"install_resource",
	],
	confirm: "remove",
	icon: PackageMinusIcon,
	name: () => m.assistant_tool_uninstall_resource_name(),
	active: () => m.assistant_tool_uninstall_resource_active(),
	refs: ({ input, output }) =>
		!output && input
			? [
					{
						kind: input.entry.resourceType,
						id: input.entry.resourceId,
					},
				]
			: [],
	line: ({ input, output }, nameOf) =>
		input
			? m.assistant_tool_uninstall_resource_summary({
					name: m.assistant_tool_quoted_name({
						name:
							output?.name ??
							nameOf({
								kind: input.entry.resourceType,
								id: input.entry.resourceId,
							}),
					}),
				})
			: m.assistant_tool_uninstall_resource_name(),
});
