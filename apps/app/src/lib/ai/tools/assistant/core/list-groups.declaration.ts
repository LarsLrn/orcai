import { UsersIcon } from "lucide-react";
import { declareTool } from "@/lib/ai/tools/declaration";
import { m } from "@/paraglide/messages";
import type { listGroupsTool } from "./list-groups";

export const listGroups = declareTool<typeof listGroupsTool>()({
	kind: "read",
	group: "core",
	icon: UsersIcon,
	name: () => m.assistant_tool_list_groups_name(),
	active: () => m.assistant_tool_list_groups_active(),
	line: ({ input, output }) => {
		if (!output) {
			return m.assistant_tool_list_groups_name();
		}

		const query = input?.query?.trim();

		return query
			? m.assistant_tool_list_groups_summary_query({
					count: output.total,
					query: m.assistant_tool_quoted_name({
						name: query,
					}),
				})
			: m.assistant_tool_list_groups_summary({
					count: output.total,
				});
	},
});
