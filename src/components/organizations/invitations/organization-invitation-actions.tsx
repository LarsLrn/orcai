import { Button } from "@/components/ui/button";
import { useRespondOrganizationInvitationMutation } from "@/hooks/mutations/use-organization-invitation-mutations";
import type { OrganizationInvitation } from "@/lib/orpc/schemas/organization-invitation";

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
				Accept
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
				Reject
			</Button>
		</div>
	);
}
