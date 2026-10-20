import { UserPlusIcon } from "lucide-react";
import { m } from "@/paraglide/messages";
import { defineToolSummary, formatNames, type NameRef } from "../summary";

const userRef = (id: string): NameRef => ({
	kind: "user",
	id,
});

export const addGroupMembersSummary = defineToolSummary<"addGroupMembers">({
	icon: UserPlusIcon,
	name: () => m.assistant_tool_add_group_members_name(),
	active: () => m.assistant_tool_add_group_members_active(),
	refs: (part) =>
		part.input
			? [
					{
						kind: "group",
						id: part.input.groupId,
					},
					...part.input.userIds.map(userRef),
				]
			: [],
	line: (part, nameOf) =>
		part.input
			? m.assistant_tool_add_group_members_summary({
					names: formatNames(
						part.input.userIds.map((id) => nameOf(userRef(id))),
					),
					group: m.assistant_tool_quoted_name({
						name: nameOf({
							kind: "group",
							id: part.input.groupId,
						}),
					}),
				})
			: m.assistant_tool_add_group_members_name(),
	verb: "add",
});
