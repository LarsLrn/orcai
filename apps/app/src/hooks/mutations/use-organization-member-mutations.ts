import { useQueryClient } from "@tanstack/react-query";
import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import { orpc } from "@/lib/orpc/orpc";

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
			loading: "Removing from the organisation...",
			success: "Removed from the organisation",
			error: "Failed to remove from the organisation",
		},
		confirm: (input) => {
			const count = input.refs.length;
			const plural = count === 1 ? "" : "s";

			return {
				title: "Remove From Organisation",
				description: `Are you sure you want to remove ${count} user${plural} from this organisation? The account${plural} stay${count === 1 ? "s" : ""} and can be invited back.`,
				confirmText: "Remove",
				cancelText: "Cancel",
			};
		},
	});
};
