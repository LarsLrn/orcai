import { ShieldCheckIcon } from "lucide-react";
import { declareTool } from "@/lib/ai/tools/declaration";
import { m } from "@/paraglide/messages";
import type { listAccessTool } from "./list-access";
import { quoted, resourceRef } from "./summary-refs";

export const listAccess = declareTool<typeof listAccessTool>()({
	kind: "read",
	group: "sharing",
	capabilities: [
		"create_bot",
	],
	icon: ShieldCheckIcon,
	name: () => m.assistant_tool_list_access_name(),
	active: () => m.assistant_tool_list_access_active(),
	refs: ({ input }) =>
		input
			? [
					resourceRef(input),
				]
			: [],
	line: ({ input, output }, nameOf) => {
		if (!input) {
			return m.assistant_tool_list_access_name();
		}

		const resource = quoted(nameOf(resourceRef(input)));

		return output
			? m.assistant_tool_list_access_summary_found({
					count: output.total,
					resource,
				})
			: m.assistant_tool_list_access_summary({
					resource,
				});
	},
});
