import { UserCogIcon } from "lucide-react";
import { getOrganizationRoleLabel } from "@/lib/authz/organization-role-metadata";
import { m } from "@/paraglide/messages";
import { defineToolSummary } from "../summary";

export const changeMemberRoleSummary = defineToolSummary<"changeMemberRole">({
	icon: UserCogIcon,
	name: () => m.assistant_tool_change_member_role_name(),
	active: () => m.assistant_tool_change_member_role_active(),
	refs: (part) =>
		part.input
			? [
					{
						kind: "user",
						id: part.input.userId,
					},
				]
			: [],
	line: (part, nameOf) =>
		part.input
			? m.assistant_tool_change_member_role_summary({
					name: m.assistant_tool_quoted_name({
						name: nameOf({
							kind: "user",
							id: part.input.userId,
						}),
					}),
					role: getOrganizationRoleLabel(part.input.role),
				})
			: m.assistant_tool_change_member_role_name(),
	verb: "change",
});
