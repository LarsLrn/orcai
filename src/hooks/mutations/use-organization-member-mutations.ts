import { useQueryClient } from "@tanstack/react-query";
import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import { orpc } from "@/lib/orpc/orpc";

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
			loading: "Deleting organisation members...",
			success: "Organisation members deleted",
			error: "Failed to delete organisation members",
		},
		confirm: (input) => {
			const count = input.refs.length;
			const plural = count === 1 ? "" : "s";

			return {
				title: `Remove Member${plural}`,
				description: `Are you sure you want to remove ${count} organisation member${plural}?`,
				confirmText: "Remove",
				cancelText: "Cancel",
			};
		},
	});
};
