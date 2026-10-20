import { MailPlusIcon } from "lucide-react";
import { getOrganizationRoleLabel } from "@/lib/authz/organization-role-metadata";
import { m } from "@/paraglide/messages";
import { defineToolSummary, formatNames } from "../summary";

export const inviteMembersSummary = defineToolSummary<"inviteMembers">({
	icon: MailPlusIcon,
	name: () => m.assistant_tool_invite_members_name(),
	active: () => m.assistant_tool_invite_members_active(),
	line: (part) =>
		part.input
			? m.assistant_tool_invite_members_summary({
					names: formatNames(
						part.state === "output-available"
							? part.output.invited.map((invitation) => invitation.email)
							: part.input.emails,
					),
					role: getOrganizationRoleLabel(part.input.role),
				})
			: m.assistant_tool_invite_members_name(),
	verb: "invite",
});
