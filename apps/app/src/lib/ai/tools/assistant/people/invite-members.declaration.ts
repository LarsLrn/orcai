import { createOrganizationInvitationsInputSchema } from "@orcai/schema";
import { MailPlusIcon } from "lucide-react";
import { z } from "zod/v4";
import { declareTool, formatNames } from "@/lib/ai/tools/declaration";
import { getOrganizationRoleLabel } from "@/lib/labels/organization-role";
import { m } from "@/paraglide/messages";
import type { inviteMembersTool } from "./invite-members";

export const inviteMembersInputSchema = z.strictObject({
	emails: z
		.array(z.email())
		.min(1)
		.max(200)
		.describe("Email addresses to invite."),
	role: createOrganizationInvitationsInputSchema.shape.role.describe(
		"The organisation role they get on accepting. Only admins can invite admins.",
	),
});

export const inviteMembers = declareTool<typeof inviteMembersTool>()({
	kind: "change",
	group: "people",
	capabilities: [
		"invite_members",
	],
	confirm: "invite",
	inputSchema: inviteMembersInputSchema,
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
