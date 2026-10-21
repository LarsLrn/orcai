import { UserMinusIcon } from "lucide-react";
import { declareTool, formatNames } from "@/lib/ai/tools/declaration";
import type { EntityRef } from "@/lib/ai/tools/entity-kind";
import { m } from "@/paraglide/messages";
import type { removeGroupMembersTool } from "./remove-group-members";

const memberRef = (id: string): EntityRef => ({
	kind: "member",
	id,
});

export const removeGroupMembers = declareTool<typeof removeGroupMembersTool>()({
	kind: "change",
	group: "people",
	capabilities: [
		"manage_groups",
	],
	confirm: "remove",
	icon: UserMinusIcon,
	name: () => m.assistant_tool_remove_group_members_name(),
	active: () => m.assistant_tool_remove_group_members_active(),
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
			? m.assistant_tool_remove_group_members_summary({
					names: formatNames(input.userIds.map((id) => nameOf(memberRef(id)))),
					group: m.assistant_tool_quoted_name({
						name: nameOf({
							kind: "group",
							id: input.groupId,
						}),
					}),
				})
			: m.assistant_tool_remove_group_members_name(),
});
