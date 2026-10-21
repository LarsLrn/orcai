import { UserPlusIcon } from "lucide-react";
import { declareTool, formatNames } from "@/lib/ai/tools/declaration";
import type { EntityRef } from "@/lib/ai/tools/entity-kind";
import { m } from "@/paraglide/messages";
import type { addGroupMembersTool } from "./add-group-members";

const memberRef = (id: string): EntityRef => ({
	kind: "member",
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
					...input.userIds.map(memberRef),
				]
			: [],
	line: ({ input }, nameOf) =>
		input
			? m.assistant_tool_add_group_members_summary({
					names: formatNames(input.userIds.map((id) => nameOf(memberRef(id)))),
					group: m.assistant_tool_quoted_name({
						name: nameOf({
							kind: "group",
							id: input.groupId,
						}),
					}),
				})
			: m.assistant_tool_add_group_members_name(),
});
