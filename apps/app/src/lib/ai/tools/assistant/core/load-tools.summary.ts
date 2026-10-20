import { PackagePlusIcon } from "lucide-react";
import { formatList } from "@/lib/presentation/format-list";
import { m } from "@/paraglide/messages";
import type { DeferredToolGroup } from "../groups";
import { defineToolSummary } from "../summary";

const groupLabels: Record<DeferredToolGroup, () => string> = {
	bots: m.assistant_tool_group_bots,
	sharing: m.assistant_tool_group_sharing,
	people: m.assistant_tool_group_people,
};

export const loadToolsSummary = defineToolSummary<"loadTools">({
	icon: PackagePlusIcon,
	name: () => m.assistant_tool_load_tools_name(),
	active: () => m.assistant_tool_load_tools_active(),
	line: (part) => {
		if (part.state !== "output-available") {
			return m.assistant_tool_load_tools_name();
		}

		const loaded = part.output.groups
			.filter((result) => result.loaded)
			.map((result) => groupLabels[result.group]());

		return loaded.length > 0
			? m.assistant_tool_load_tools_summary({
					groups: formatList(loaded),
				})
			: m.assistant_tool_load_tools_none();
	},
});
