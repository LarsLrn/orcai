import type { OrganizationInvitationStatus } from "@orcai/schema";
import { MailIcon } from "lucide-react";
import { declareTool } from "@/lib/ai/tools/declaration";
import { m } from "@/paraglide/messages";
import type { listInvitationsTool } from "./list-invitations";

const statusLabels: Record<OrganizationInvitationStatus, () => string> = {
	pending: m.orgs_invitation_status_pending,
	accepted: m.orgs_invitation_status_accepted,
	rejected: m.orgs_invitation_status_rejected,
};

export const listInvitations = declareTool<typeof listInvitationsTool>()({
	kind: "read",
	group: "people",
	capabilities: [
		"invite_members",
	],
	icon: MailIcon,
	name: () => m.assistant_tool_list_invitations_name(),
	active: () => m.assistant_tool_list_invitations_active(),
	line: ({ input, output }) =>
		output
			? m.assistant_tool_list_invitations_summary_found({
					count: output.total,
					status: statusLabels[input?.status ?? "pending"](),
				})
			: m.assistant_tool_list_invitations_name(),
});
