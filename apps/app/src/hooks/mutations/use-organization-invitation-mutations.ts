import { useDeleteAction } from "@/hooks/actions/use-delete-action";
import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import type { DestructiveTarget } from "@/hooks/mutations/destructive-target";
import { useUmami } from "@/hooks/use-umami";
import { orpc } from "@/lib/orpc/orpc";
import { formatList } from "@/lib/presentation/format-list";
import { m } from "@/paraglide/messages";

export const useCreateOrganizationInvitationMutation = () => {
	return useMutationAction({
		mutationOptions: () => orpc.organizationInvitation.create.mutationOptions(),
		messages: {
			loading: m.orgs_invitation_create_toast_loading(),
			success: ({ data }) =>
				data.skipped.length > 0
					? m.orgs_invitation_create_toast_skipped({
							emails: formatList(data.skipped.map((invitee) => invitee.email)),
						})
					: m.orgs_invitation_create_toast_success(),
			error: m.orgs_invitation_create_toast_error(),
		},
	});
};

export const useDeleteOrganizationInvitationsMutation = (
	target?: DestructiveTarget,
) =>
	useDeleteAction({
		mutationOptions: () => orpc.organizationInvitation.delete.mutationOptions(),
		copy: {
			loading: m.orgs_invitation_delete_toast_loading,
			success: m.orgs_invitation_delete_toast_success,
			error: m.orgs_invitation_delete_toast_error,
			title: m.orgs_invitation_delete_confirm_title,
			namedTitle: m.orgs_invitation_delete_confirm_title_named,
			description: m.orgs_invitation_delete_confirm_description,
			confirmText: m.common_delete_button,
		},
		target,
	});

export const useRespondOrganizationInvitationMutation = () => {
	const { trackEvent } = useUmami();

	return useMutationAction({
		mutationOptions: () =>
			orpc.organizationInvitation.respond.mutationOptions({
				onSuccess: (_result, variables) => {
					trackEvent("respond-organization-invitation", {
						invitationId: variables.id,
						response: variables.response,
					});
				},
			}),
		messages: {
			loading: ({ input }) =>
				input.response === "accept"
					? m.orgs_invitation_accept_toast_loading()
					: m.orgs_invitation_reject_toast_loading(),
			success: ({ input }) =>
				input.response === "accept"
					? m.orgs_invitation_accept_toast_success()
					: m.orgs_invitation_reject_toast_success(),
			error: ({ input }) =>
				input.response === "accept"
					? m.orgs_invitation_accept_toast_error()
					: m.orgs_invitation_reject_toast_error(),
		},
	});
};
