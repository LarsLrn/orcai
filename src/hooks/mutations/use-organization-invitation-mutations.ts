import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import { useUmami } from "@/hooks/use-umami";
import { orpc } from "@/lib/orpc/orpc";

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
			loading: "Creating invitations...",
			success: "Invitations created successfully",
			error: "Failed to create invitations",
		},
	});
};

export const useDeleteOrganizationInvitationsMutation = (
	opts: ReturnType<
		typeof orpc.organizationInvitation.delete.mutationOptions
	> = {},
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
			loading: "Deleting invitations...",
			success: "Invitations deleted",
			error: "Failed to delete invitations",
		},
		confirm: (input) => {
			const count = input.refs.length;
			const plural = count === 1 ? "" : "s";

			return {
				title: `Delete Invitation${plural}`,
				description: `Are you sure you want to delete ${count} invitation${plural}? This action cannot be undone.`,
				confirmText: "Delete",
				cancelText: "Cancel",
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
					? "Accepting invitation..."
					: "Rejecting invitation...",
			success: ({ input }) =>
				input.response === "accept"
					? "Invitation accepted"
					: "Invitation rejected",
			error: ({ input }) =>
				input.response === "accept"
					? "Failed to accept invitation"
					: "Failed to reject invitation",
		},
	});
};
