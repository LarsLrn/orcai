import { UserCogIcon } from "lucide-react";
import { declareTool } from "@/lib/ai/tools/declaration";
import { getOrganizationRoleLabel } from "@/lib/authz/organization-role-metadata";
import { m } from "@/paraglide/messages";
import type { changeMemberRoleTool } from "./change-member-role";

export const changeMemberRole = declareTool<typeof changeMemberRoleTool>()({
	kind: "change",
	group: "people",
	capabilities: [
		"manage_members",
	],
	confirm: "change",
	icon: UserCogIcon,
	name: () => m.assistant_tool_change_member_role_name(),
	active: () => m.assistant_tool_change_member_role_active(),
	refs: ({ input }) =>
		input
			? [
					{
						kind: "user",
						id: input.userId,
					},
				]
			: [],
	line: ({ input }, nameOf) =>
		input
			? m.assistant_tool_change_member_role_summary({
					name: m.assistant_tool_quoted_name({
						name: nameOf({
							kind: "user",
							id: input.userId,
						}),
					}),
					role: getOrganizationRoleLabel(input.role),
				})
			: m.assistant_tool_change_member_role_name(),
});
