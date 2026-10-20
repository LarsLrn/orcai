import { UserRoundIcon } from "lucide-react";
import { m } from "@/paraglide/messages";
import { defineToolSummary } from "../summary";

export const listMembersSummary = defineToolSummary<"listMembers">({
	icon: UserRoundIcon,
	name: () => m.assistant_tool_list_members_name(),
	active: () => m.assistant_tool_list_members_active(),
	line: (part) => {
		if (part.state !== "output-available") {
			return m.assistant_tool_list_members_name();
		}

		const count = part.output.total;
		const query = part.input?.query?.trim();

		return query
			? m.assistant_tool_list_members_summary_query({
					count,
					query: m.assistant_tool_quoted_name({
						name: query,
					}),
				})
			: m.assistant_tool_list_members_summary({
					count,
				});
	},
});
