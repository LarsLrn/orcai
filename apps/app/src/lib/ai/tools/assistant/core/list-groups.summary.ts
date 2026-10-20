import { UsersIcon } from "lucide-react";
import { m } from "@/paraglide/messages";
import { defineToolSummary } from "../summary";

export const listGroupsSummary = defineToolSummary<"listGroups">({
	icon: UsersIcon,
	name: () => m.assistant_tool_list_groups_name(),
	active: () => m.assistant_tool_list_groups_active(),
	line: (part) => {
		if (part.state !== "output-available") {
			return m.assistant_tool_list_groups_name();
		}

		const count = part.output.total;
		const query = part.input?.query?.trim();

		return query
			? m.assistant_tool_list_groups_summary_query({
					count,
					query: m.assistant_tool_quoted_name({
						name: query,
					}),
				})
			: m.assistant_tool_list_groups_summary({
					count,
				});
	},
});
