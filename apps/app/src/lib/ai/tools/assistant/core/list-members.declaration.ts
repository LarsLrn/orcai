import { UserRoundIcon } from "lucide-react";
import { declareTool } from "@/lib/ai/tools/declaration";
import { m } from "@/paraglide/messages";
import type { listMembersTool } from "./list-members";

export const listMembers = declareTool<typeof listMembersTool>()({
	kind: "read",
	group: "core",
	capabilities: [
		"manage_members",
	],
	icon: UserRoundIcon,
	name: () => m.assistant_tool_list_members_name(),
	active: () => m.assistant_tool_list_members_active(),
	line: ({ input, output }) => {
		if (!output) {
			return m.assistant_tool_list_members_name();
		}

		const query = input?.query?.trim();

		return query
			? m.assistant_tool_list_members_summary_query({
					count: output.total,
					query: m.assistant_tool_quoted_name({
						name: query,
					}),
				})
			: m.assistant_tool_list_members_summary({
					count: output.total,
				});
	},
});
