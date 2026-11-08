import { PackagePlusIcon } from "lucide-react";
import { z } from "zod/v4";
import {
	DEFERRED_TOOL_GROUPS,
	type DeferredToolGroup,
	declareTool,
} from "@/lib/ai/tools/declaration";
import { formatList } from "@/lib/presentation/format-list";
import { m } from "@/paraglide/messages";
import type { loadToolsTool } from "./load-tools";

const groupLabels: Record<DeferredToolGroup, () => string> = {
	bots: m.assistant_tool_group_bots,
	sharing: m.assistant_tool_group_sharing,
	people: m.assistant_tool_group_people,
};

export const loadToolsInputSchema = z.strictObject({
	groups: z
		.array(z.enum(DEFERRED_TOOL_GROUPS))
		.min(1)
		.describe("Every tool group this request needs, in one call."),
});

export const loadTools = declareTool<typeof loadToolsTool>()({
	kind: "read",
	group: "core",
	inputSchema: loadToolsInputSchema,
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
