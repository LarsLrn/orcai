import { MailXIcon } from "lucide-react";
import { m } from "@/paraglide/messages";
import { defineToolSummary, formatNames } from "../summary";

export const cancelInvitationSummary = defineToolSummary<"cancelInvitation">({
	icon: MailXIcon,
	name: () => m.assistant_tool_cancel_invitation_name(),
	active: () => m.assistant_tool_cancel_invitation_active(),
	refs: (part) =>
		part.state === "output-available"
			? part.output.withdrawn
					.filter((invitation) => invitation.email === undefined)
					.map((invitation) => ({
						kind: "invitation",
						id: invitation.id,
					}))
			: (part.input?.ids ?? []).map((id) => ({
					kind: "invitation",
					id,
				})),
	line: (part, nameOf) => {
		const names =
			part.state === "output-available"
				? part.output.withdrawn.map(
						(invitation) =>
							invitation.email ??
							nameOf({
								kind: "invitation",
								id: invitation.id,
							}),
					)
				: (part.input?.ids ?? []).map((id) =>
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
	verb: "withdraw",
});
