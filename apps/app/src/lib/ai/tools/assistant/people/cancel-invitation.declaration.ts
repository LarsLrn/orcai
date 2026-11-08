import { organizationInvitationIdSchema } from "@orcai/schema";
import { MailXIcon } from "lucide-react";
import { z } from "zod/v4";
import { declareTool, formatNames } from "@/lib/ai/tools/declaration";
import { m } from "@/paraglide/messages";
import type { cancelInvitationTool } from "./cancel-invitation";

export const cancelInvitationInputSchema = z.strictObject({
	ids: z
		.array(organizationInvitationIdSchema)
		.min(1)
		.max(20)
		.describe("Ids of the invitations to withdraw, from listInvitations."),
});

export const cancelInvitation = declareTool<typeof cancelInvitationTool>()({
	kind: "change",
	group: "people",
	capabilities: [
		"invite_members",
	],
	confirm: "withdraw",
	inputSchema: cancelInvitationInputSchema,
	icon: MailXIcon,
	name: () => m.assistant_tool_cancel_invitation_name(),
	active: () => m.assistant_tool_cancel_invitation_active(),
	refs: ({ input, output }) =>
		output
			? output.withdrawn
					.filter((invitation) => invitation.email === undefined)
					.map((invitation) => ({
						kind: "invitation",
						id: invitation.id,
					}))
			: (input?.ids ?? []).map((id) => ({
					kind: "invitation",
					id,
				})),
	line: ({ input, output }, nameOf) => {
		const names = output
			? output.withdrawn.map(
					(invitation) =>
						invitation.email ??
						nameOf({
							kind: "invitation",
							id: invitation.id,
						}),
				)
			: (input?.ids ?? []).map((id) =>
					nameOf({
						kind: "invitation",
						id,
					}),
				);

		return m.assistant_tool_cancel_invitation_summary({
			names: formatNames(names),
			count: names.length,
		});
	},
});
