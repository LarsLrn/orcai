import { UsersRoundIcon } from "lucide-react";
import { m } from "@/paraglide/messages";
import { defineToolSummary } from "../summary";

export const listGroupMembersSummary = defineToolSummary<"listGroupMembers">({
	icon: UsersRoundIcon,
	name: () => m.assistant_tool_list_group_members_name(),
	active: () => m.assistant_tool_list_group_members_active(),
	refs: (part) =>
		part.input
			? [
					{
						kind: "group",
						id: part.input.groupId,
					},
				]
			: [],
	line: (part, nameOf) => {
		if (!part.input) {
			return m.assistant_tool_list_group_members_name();
		}

		const group = m.assistant_tool_quoted_name({
			name: nameOf({
				kind: "group",
				id: part.input.groupId,
			}),
		});

		return part.state === "output-available"
			? m.assistant_tool_list_group_members_summary_found({
					count: part.output.total,
					group,
				})
			: m.assistant_tool_list_group_members_summary({
					group,
				});
	},
});
