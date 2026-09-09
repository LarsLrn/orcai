import { useQueryClient } from "@tanstack/react-query";
import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import {
	type DestructiveTarget,
	describeFailure,
	describeOutcome,
	describeProgress,
	describeTarget,
} from "@/hooks/mutations/destructive-copy";
import { orpc } from "@/lib/orpc/orpc";

const MEMBER_NOUNS = {
	noun: "member",
	nounPlural: "members",
};

export const useUpdateOrganizationMemberMutation = (
	opts: ReturnType<typeof orpc.organizationMember.update.mutationOptions> = {},
) => {
	const queryClient = useQueryClient();

	return useMutationAction({
		mutationOptions: () =>
			orpc.organizationMember.update.mutationOptions({
				...opts,
				onSuccess: async (...args) => {
					queryClient.invalidateQueries({
						queryKey: orpc.user.key(),
					});
					queryClient.invalidateQueries({
						queryKey: orpc.organizationMember.key(),
					});
					queryClient.invalidateQueries({
						queryKey: orpc.authorization.key(),
					});

					try {
						await opts.onSuccess?.(...args);
					} catch (error) {
						console.error(
							"useUpdateOrganizationMemberMutation onSuccess callback failed:",
							error,
						);
					}
				},
			}),
		messages: {
			loading: "Updating role...",
			success: "Role updated",
			error: "Failed to update role",
		},
	});
};

/** Removes memberships from the active organisation. The accounts stay. */
export const useDeleteOrganizationMembersMutation = (
	opts: ReturnType<typeof orpc.organizationMember.delete.mutationOptions> = {},
	target?: DestructiveTarget,
) => {
	const queryClient = useQueryClient();

	return useMutationAction({
		mutationOptions: () =>
			orpc.organizationMember.delete.mutationOptions({
				...opts,
				onSuccess: async (...args) => {
					queryClient.invalidateQueries({
						queryKey: orpc.user.key(),
					});
					queryClient.invalidateQueries({
						queryKey: orpc.organizationMember.key(),
					});

					try {
						await opts.onSuccess?.(...args);
					} catch (error) {
						console.error(
							"useDeleteOrganizationMembersMutation onSuccess callback failed:",
							error,
						);
					}
				},
			}),
		messages: {
			loading: ({ input }) =>
				describeProgress("Removing", input.refs.length, MEMBER_NOUNS, target),
			success: ({ input }) =>
				describeOutcome(
					input.refs.length,
					MEMBER_NOUNS,
					"removed from the organisation",
					target,
				),
			error: ({ input }) =>
				describeFailure(
					input.refs.length,
					MEMBER_NOUNS,
					"removed from the organisation",
					target,
				),
		},
		// "Remove" is the confirm label the users and groups e2e specs click.
		confirm: (input) => {
			const count = input.refs.length;

			return {
				title: `Remove ${describeTarget(count, MEMBER_NOUNS, target)} from the organisation?`,
				description:
					count === 1
						? "The person loses access to everything in this organisation. Their account stays and can be invited back."
						: "Those people lose access to everything in this organisation. Their accounts stay and can be invited back.",
				confirmText: "Remove",
				cancelText: "Cancel",
			};
		},
	});
};
