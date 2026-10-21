import { UsersRoundIcon } from "lucide-react";
import { declareTool } from "@/lib/ai/tools/declaration";
import { m } from "@/paraglide/messages";
import type { listGroupMembersTool } from "./list-group-members";

export const listGroupMembers = declareTool<typeof listGroupMembersTool>()({
	kind: "read",
	group: "people",
	capabilities: [
		"manage_groups",
	],
	icon: UsersRoundIcon,
	name: () => m.assistant_tool_list_group_members_name(),
	active: () => m.assistant_tool_list_group_members_active(),
	refs: ({ input }) =>
		input
			? [
					{
						kind: "group",
						id: input.groupId,
					},
				]
			: [],
	line: ({ input, output }, nameOf) => {
		if (!input) {
			return m.assistant_tool_list_group_members_name();
		}

		const group = m.assistant_tool_quoted_name({
			name: nameOf({
				kind: "group",
				id: input.groupId,
			}),
		});

		return output
			? m.assistant_tool_list_group_members_summary_found({
					count: output.total,
					group,
				})
			: m.assistant_tool_list_group_members_summary({
					group,
				});
	},
});
