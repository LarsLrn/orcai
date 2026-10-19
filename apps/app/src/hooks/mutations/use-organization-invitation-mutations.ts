import { useQueryClient } from "@tanstack/react-query";
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
	const queryClient = useQueryClient();

	return useMutationAction({
		mutationOptions: () =>
			orpc.organizationInvitation.create.mutationOptions({
				...opts,
				onSuccess: async (...args) => {
					queryClient.invalidateQueries({
						queryKey: orpc.organizationInvitation.key(),
					});

					await router.navigate({
						to: "/app/users/invites",
					});

					try {
						await opts.onSuccess?.(...args);
					} catch (error) {
						console.error(
							"useCreateOrganizationInvitationMutation onSuccess callback failed:",
							error,
						);
					}
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
	const queryClient = useQueryClient();

	return useMutationAction({
		mutationOptions: () =>
			orpc.organizationInvitation.delete.mutationOptions({
				...opts,
				onSuccess: async (...args) => {
					queryClient.invalidateQueries({
						queryKey: orpc.organizationInvitation.key(),
					});

					try {
						await opts.onSuccess?.(...args);
					} catch (error) {
						console.error(
							"useDeleteOrganizationInvitationsMutation onSuccess callback failed:",
							error,
						);
					}
				},
			}),
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
	const queryClient = useQueryClient();
	const { trackEvent } = useUmami();

	return useMutationAction({
		mutationOptions: () =>
			orpc.organizationInvitation.respond.mutationOptions({
				...opts,
				onSuccess: async (result, variables, ...args) => {
					queryClient.invalidateQueries({
						queryKey: orpc.organizationInvitation.key(),
					});
					if (variables.response === "accept") {
						queryClient.invalidateQueries({
							queryKey: orpc.organization.key(),
						});
					}

					trackEvent("respond-organization-invitation", {
						invitationId: variables.id,
						response: variables.response,
					});

					try {
						await opts.onSuccess?.(result, variables, ...args);
					} catch (error) {
						console.error(
							"useRespondOrganizationInvitationMutation onSuccess callback failed:",
							error,
						);
					}
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
