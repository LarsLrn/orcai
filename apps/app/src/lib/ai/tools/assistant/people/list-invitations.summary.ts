import type { OrganizationInvitationStatus } from "@orcai/schema";
import { MailIcon } from "lucide-react";
import { m } from "@/paraglide/messages";
import { defineToolSummary } from "../summary";

const statusLabels: Record<OrganizationInvitationStatus, () => string> = {
	pending: m.orgs_invitation_status_pending,
	accepted: m.orgs_invitation_status_accepted,
	rejected: m.orgs_invitation_status_rejected,
};

export const listInvitationsSummary = defineToolSummary<"listInvitations">({
	icon: MailIcon,
	name: () => m.assistant_tool_list_invitations_name(),
	active: () => m.assistant_tool_list_invitations_active(),
	line: (part) =>
		part.state === "output-available"
			? m.assistant_tool_list_invitations_summary_found({
					count: part.output.total,
					status: statusLabels[part.input?.status ?? "pending"](),
				})
			: m.assistant_tool_list_invitations_name(),
});
