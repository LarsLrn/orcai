import { useQueryClient } from "@tanstack/react-query";
import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import { orpc } from "@/lib/orpc/orpc";

export const useDeleteUsersMutation = (
	opts: ReturnType<typeof orpc.user.delete.mutationOptions> = {},
) => {
	const queryClient = useQueryClient();

	return useMutationAction({
		mutationOptions: () =>
			orpc.user.delete.mutationOptions({
				...opts,
				onSuccess: async (...args) => {
					queryClient.invalidateQueries({
						queryKey: orpc.user.key(),
					});

					try {
						await opts.onSuccess?.(...args);
					} catch (error) {
						console.error(
							"useDeleteUsersMutation onSuccess callback failed:",
							error,
						);
					}
				},
			}),
		messages: {
			loading: "Deleting users...",
			success: "Users deleted",
			error: "Failed to delete users",
		},
		confirm: (input) => {
			const count = input.userIds.length;
			const plural = count === 1 ? "" : "s";

			return {
				title: `Delete User${plural}`,
				description: `Are you sure you want to delete ${count} user${plural}? This action cannot be undone.`,
				confirmText: "Delete",
				cancelText: "Cancel",
			};
		},
	});
};
