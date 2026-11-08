import { organizationMemberSchema } from "@orcai/schema";
import { UserCogIcon } from "lucide-react";
import { declareTool } from "@/lib/ai/tools/declaration";
import { getOrganizationRoleLabel } from "@/lib/authz/organization-role-metadata";
import { m } from "@/paraglide/messages";
import type { changeMemberRoleTool } from "./change-member-role";
import { receiverIdSchema } from "./receiver-input";

export const changeMemberRoleInputSchema = organizationMemberSchema
	.pick({
		userId: true,
		role: true,
	})
	.extend({
		userId: organizationMemberSchema.shape.userId.describe(
			"Id of the member, from listMembers.",
		),
		receiverId: receiverIdSchema.describe(
			"Only when the role becomes viewer: id of the member, from listMembers, who receives the bots, blocks and Library assets this member owns here. Must be a Member, Manager or Admin who is not banned. Leave out to give them to the user, which works only when the user is a Member, Manager or Admin here.",
		),
	})
	.strict();

export const changeMemberRole = declareTool<typeof changeMemberRoleTool>()({
	kind: "change",
	group: "people",
	capabilities: [
		"manage_members",
	],
	confirm: "change",
	inputSchema: changeMemberRoleInputSchema,
	icon: UserCogIcon,
	name: () => m.assistant_tool_change_member_role_name(),
	active: () => m.assistant_tool_change_member_role_active(),
	refs: ({ input }) =>
		input
			? [
					{
						kind: "member",
						id: input.userId,
					},
				]
			: [],
	line: ({ input }, nameOf) =>
		input
			? m.assistant_tool_change_member_role_summary({
					name: m.assistant_tool_quoted_name({
						name: nameOf({
							kind: "member",
							id: input.userId,
						}),
					}),
					role: getOrganizationRoleLabel(input.role),
				})
			: m.assistant_tool_change_member_role_name(),
});
