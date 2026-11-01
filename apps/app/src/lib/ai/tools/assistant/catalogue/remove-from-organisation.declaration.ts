import { PackageMinusIcon } from "lucide-react";
import { declareTool } from "@/lib/ai/tools/declaration";
import { m } from "@/paraglide/messages";
import type { removeFromOrganisationTool } from "./remove-from-organisation";

export const removeFromOrganisation = declareTool<
	typeof removeFromOrganisationTool
>()({
	kind: "change",
	group: "bots",
	capabilities: [
		"add_from_catalogue",
	],
	confirm: "remove",
	icon: PackageMinusIcon,
	name: () => m.assistant_tool_remove_from_organisation_name(),
	active: () => m.assistant_tool_remove_from_organisation_active(),
	refs: ({ input, output }) =>
		!output && input
			? [
					{
						kind: input.entry.targetType,
						id: input.entry.targetId,
					},
				]
			: [],
	line: ({ input, output }, nameOf) =>
		input
			? m.assistant_tool_remove_from_organisation_summary({
					name: m.assistant_tool_quoted_name({
						name:
							output?.name ??
							nameOf({
								kind: input.entry.targetType,
								id: input.entry.targetId,
							}),
					}),
				})
			: m.assistant_tool_remove_from_organisation_name(),
});
