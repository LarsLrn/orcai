import type { OrganizationInvitationListItem } from "@orcai/schema";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/dialog/confirm-dialog";
import { useRespondOrganizationInvitationMutation } from "@/hooks/mutations/use-organization-invitation-mutations";
import { m } from "@/paraglide/messages";

type OrganizationInvitationActionsProps = {
	invitation: OrganizationInvitationListItem;
	onAccepted?: () => void | Promise<void>;
	onRejected?: () => void | Promise<void>;
};

export function OrganizationInvitationActions({
	invitation,
	onAccepted,
	onRejected,
}: OrganizationInvitationActionsProps) {
	const confirm = useConfirm();
	const respondInvitation = useRespondOrganizationInvitationMutation({
		onSuccess: async (_result, variables) => {
			if (variables.response === "accept") {
				await onAccepted?.();
			} else {
				await onRejected?.();
			}
		},
	});

	const pendingResponse = respondInvitation.isPending
		? respondInvitation.variables?.response
		: undefined;

	const reject = async () => {
		const isConfirmed = await confirm({
			title: m.orgs_invitation_reject_confirm_title({
				name: invitation.organizationName,
			}),
			description: m.orgs_invitation_reject_confirm_description(),
			confirmText: m.orgs_invitation_reject_confirm_button(),
			cancelText: m.common_cancel_button(),
		});

		if (isConfirmed) {
			respondInvitation.mutate({
				id: invitation.id,
				response: "reject",
			});
		}
	};

	return (
		<div className="mt-2 flex gap-2">
			<Button
				onClick={() =>
					respondInvitation.mutate({
						id: invitation.id,
						response: "accept",
					})
				}
				loading={pendingResponse === "accept"}
				disabled={respondInvitation.isPending}
				variant="default"
				size="sm"
			>
				{m.orgs_invitation_accept_button()}
			</Button>
			<Button
				onClick={() => void reject()}
				loading={pendingResponse === "reject"}
				disabled={respondInvitation.isPending}
				variant="destructive"
				size="sm"
			>
				{m.orgs_invitation_reject_button()}
			</Button>
		</div>
	);
}
