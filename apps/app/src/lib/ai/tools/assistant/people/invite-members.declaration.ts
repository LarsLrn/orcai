import { MailPlusIcon } from "lucide-react";
import { declareTool, formatNames } from "@/lib/ai/tools/declaration";
import { getOrganizationRoleLabel } from "@/lib/authz/organization-role-metadata";
import { m } from "@/paraglide/messages";
import type { inviteMembersTool } from "./invite-members";

export const inviteMembers = declareTool<typeof inviteMembersTool>()({
	kind: "change",
	group: "people",
	capabilities: [
		"invite_members",
	],
	confirm: "invite",
	icon: MailPlusIcon,
	name: () => m.assistant_tool_invite_members_name(),
	active: () => m.assistant_tool_invite_members_active(),
	line: ({ input, output }) => {
		if (!input) {
			return m.assistant_tool_invite_members_name();
		}
		if (output && output.invited.length === 0) {
			return m.assistant_tool_invite_members_skipped({
				names: formatNames(output.skipped.map((invitee) => invitee.email)),
			});
		}
		return m.assistant_tool_invite_members_summary({
			names: formatNames(
				output
					? output.invited.map((invitation) => invitation.email)
					: input.emails,
			),
			role: getOrganizationRoleLabel(input.role),
		});
	},
});
