import { UserPlusIcon } from "lucide-react";
import {
	declareTool,
	formatNames,
	type NameRef,
} from "@/lib/ai/tools/declaration";
import { m } from "@/paraglide/messages";
import type { addGroupMembersTool } from "./add-group-members";

const userRef = (id: string): NameRef => ({
	kind: "user",
	id,
});

export const addGroupMembers = declareTool<typeof addGroupMembersTool>()({
	kind: "change",
	group: "people",
	capabilities: [
		"manage_groups",
	],
	confirm: "add",
	icon: UserPlusIcon,
	name: () => m.assistant_tool_add_group_members_name(),
	active: () => m.assistant_tool_add_group_members_active(),
	refs: ({ input }) =>
		input
			? [
					{
						kind: "group",
						id: input.groupId,
					},
					...input.userIds.map(userRef),
				]
			: [],
	line: ({ input }, nameOf) =>
		input
			? m.assistant_tool_add_group_members_summary({
					names: formatNames(input.userIds.map((id) => nameOf(userRef(id)))),
					group: m.assistant_tool_quoted_name({
						name: nameOf({
							kind: "group",
							id: input.groupId,
						}),
					}),
				})
			: m.assistant_tool_add_group_members_name(),
});
