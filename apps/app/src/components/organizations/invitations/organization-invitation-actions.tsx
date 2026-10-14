import type { OrganizationInvitation } from "@orcai/schema";
import { Button } from "@/components/ui/button";
import { useRespondOrganizationInvitationMutation } from "@/hooks/mutations/use-organization-invitation-mutations";
import { m } from "@/paraglide/messages";

type OrganizationInvitationActionsProps = {
	invitation: OrganizationInvitation;
	onAccepted?: () => void | Promise<void>;
	onRejected?: () => void | Promise<void>;
};

export function OrganizationInvitationActions({
	invitation,
	onAccepted,
	onRejected,
}: OrganizationInvitationActionsProps) {
	const { mutate: respondInvitation } =
		useRespondOrganizationInvitationMutation({
			onSuccess: async (_result, variables) => {
				if (variables.response === "accept") {
					await onAccepted?.();
				} else {
					await onRejected?.();
				}
			},
		});

	return (
		<div className="mt-2 flex gap-2">
			<Button
				onClick={() =>
					respondInvitation({
						id: invitation.id,
						response: "accept",
					})
				}
				variant="default"
				size="sm"
			>
				{m.orgs_invitation_accept_button()}
			</Button>
			<Button
				onClick={() =>
					respondInvitation({
						id: invitation.id,
						response: "reject",
					})
				}
				variant="destructive"
				size="sm"
			>
				{m.orgs_invitation_reject_button()}
			</Button>
		</div>
	);
}
