import { useRouter } from "@tanstack/react-router";
import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import {
	type DestructiveTarget,
	singleTargetName,
} from "@/hooks/mutations/destructive-target";
import { useUmami } from "@/hooks/use-umami";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

export const useCreateOrganizationInvitationMutation = (
	opts: ReturnType<
		typeof orpc.organizationInvitation.create.mutationOptions
	> = {},
) => {
	const router = useRouter();

	return useMutationAction({
		mutationOptions: () =>
			orpc.organizationInvitation.create.mutationOptions({
				...opts,
				onSuccess: async (...args) => {
					await router.navigate({
						to: "/app/members/invitations",
					});

					await opts.onSuccess?.(...args);
				},
			}),
		messages: {
			loading: m.orgs_invitation_create_toast_loading(),
			success: m.orgs_invitation_create_toast_success(),
			error: m.orgs_invitation_create_toast_error(),
		},
	});
};

export const useDeleteOrganizationInvitationsMutation = (
	opts: ReturnType<
		typeof orpc.organizationInvitation.delete.mutationOptions
	> = {},
	target?: DestructiveTarget,
) => {
	return useMutationAction({
		mutationOptions: () =>
			orpc.organizationInvitation.delete.mutationOptions(opts),
		messages: {
			loading: ({ input }) =>
				m.orgs_invitation_delete_toast_loading({
					count: input.refs.length,
				}),
			success: ({ input }) =>
				m.orgs_invitation_delete_toast_success({
					count: input.refs.length,
				}),
			error: ({ input }) =>
				m.orgs_invitation_delete_toast_error({
					count: input.refs.length,
				}),
		},
		confirm: (input) => {
			const count = input.refs.length;
			const name = singleTargetName(count, target);

			return {
				title: name
					? m.orgs_invitation_delete_confirm_title_named({
							name,
						})
					: m.orgs_invitation_delete_confirm_title({
							count,
						}),
				description: m.orgs_invitation_delete_confirm_description({
					count,
				}),
				confirmText: m.common_delete_button(),
				cancelText: m.common_cancel_button(),
			};
		},
	});
};

export const useRespondOrganizationInvitationMutation = (
	opts: ReturnType<
		typeof orpc.organizationInvitation.respond.mutationOptions
	> = {},
) => {
	const { trackEvent } = useUmami();

	return useMutationAction({
		mutationOptions: () =>
			orpc.organizationInvitation.respond.mutationOptions({
				...opts,
				onSuccess: async (result, variables, ...args) => {
					trackEvent("respond-organization-invitation", {
						invitationId: variables.id,
						response: variables.response,
					});

					await opts.onSuccess?.(result, variables, ...args);
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
