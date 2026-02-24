import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useUmami } from "@/hooks/use-umami";
import { orpc } from "@/lib/orpc/orpc";
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
	const { trackEvent } = useUmami();
	const { mutateAsync: respondToInvitation } = useMutation(
		orpc.organizationInvitation.respond.mutationOptions(),
	);

	const handleRespond = (response: "accept" | "reject") => {
		const isAccept = response === "accept";

		toast.promise(
			respondToInvitation({
				id: invitation.id,
				response,
			}),
			{
				loading: isAccept
					? "Accepting invitation..."
					: "Rejecting invitation...",
				success: async () => {
					if (isAccept) {
						trackEvent("accept-organization-invitation", {
							organizationId: invitation.organizationId,
						});
						await onAccepted?.();
						return "Invitation accepted";
					}

					trackEvent("reject-organization-invitation", {
						organizationId: invitation.organizationId,
					});
					await onRejected?.();
					return "Invitation rejected";
				},
				error: (error) => ({
					message: isAccept
						? "Failed to accept invitation"
						: "Failed to reject invitation",
					description: error.message,
				}),
			},
		);
	};

	return (
		<div className="mt-2 flex gap-2">
			<Button
				onClick={() => handleRespond("accept")}
				variant="default"
				size="sm"
			>
				Accept
			</Button>
			<Button
				onClick={() => handleRespond("reject")}
				variant="destructive"
				size="sm"
			>
				Reject
			</Button>
		</div>
	);
}
