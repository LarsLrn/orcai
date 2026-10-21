import { PackagePlusIcon } from "lucide-react";
import { declareTool } from "@/lib/ai/tools/declaration";
import { formatList } from "@/lib/presentation/format-list";
import { m } from "@/paraglide/messages";
import type { DeferredToolGroup } from "../groups";
import type { loadToolsTool } from "./load-tools";

const groupLabels: Record<DeferredToolGroup, () => string> = {
	bots: m.assistant_tool_group_bots,
	sharing: m.assistant_tool_group_sharing,
	people: m.assistant_tool_group_people,
};

export const loadTools = declareTool<typeof loadToolsTool>()({
	kind: "read",
	group: "core",
	icon: PackagePlusIcon,
	name: () => m.assistant_tool_load_tools_name(),
	active: () => m.assistant_tool_load_tools_active(),
	line: ({ output }) => {
		if (!output) {
			return m.assistant_tool_load_tools_name();
		}

		const loaded = output.groups
			.filter((result) => result.loaded)
			.map((result) => groupLabels[result.group]());

		return loaded.length > 0
			? m.assistant_tool_load_tools_summary({
					groups: formatList(loaded),
				})
			: m.assistant_tool_load_tools_none();
	},
});
