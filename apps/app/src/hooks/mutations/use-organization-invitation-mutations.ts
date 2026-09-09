import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import {
	type DestructiveTarget,
	describeFailure,
	describeOutcome,
	describeProgress,
	describeTarget,
} from "@/hooks/mutations/destructive-copy";
import { useUmami } from "@/hooks/use-umami";
import { orpc } from "@/lib/orpc/orpc";

const INVITATION_NOUNS = {
	noun: "invitation",
	nounPlural: "invitations",
};

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
				describeProgress(
					"Deleting",
					input.refs.length,
					INVITATION_NOUNS,
					target,
				),
			success: ({ input }) =>
				describeOutcome(input.refs.length, INVITATION_NOUNS, "deleted", target),
			error: ({ input }) =>
				describeFailure(input.refs.length, INVITATION_NOUNS, "deleted", target),
		},
		// "Delete" is the confirm label the invitations e2e spec clicks.
		confirm: (input) => {
			const count = input.refs.length;

			return {
				title: `Delete ${describeTarget(count, INVITATION_NOUNS, target)}?`,
				description:
					count === 1
						? "The invitation link stops working. Invite the person again to let them join."
						: "Their invitation links stop working. Invite those people again to let them join.",
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
