import { useQueryClient } from "@tanstack/react-query";
import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import { orpc } from "@/lib/orpc/orpc";

export const useSaveAssetMutation = (
	opts: ReturnType<typeof orpc.asset.save.mutationOptions> = {},
) => {
	const queryClient = useQueryClient();

	return useMutationAction({
		mutationOptions: () =>
			orpc.asset.save.mutationOptions({
				...opts,
				onSuccess: async (...args) => {
					queryClient.invalidateQueries({
						queryKey: orpc.asset.key(),
					});

					try {
						await opts.onSuccess?.(...args);
					} catch (error) {
						console.error(
							"useSaveAssetMutation onSuccess callback failed:",
							error,
						);
					}
				},
			}),
		messages: {
			loading: "Saving asset...",
			success: "Asset saved",
			error: "Failed to save asset",
		},
	});
};

export const useSaveManyAssetsMutation = (
	opts: ReturnType<typeof orpc.asset.saveMany.mutationOptions> = {},
) => {
	const queryClient = useQueryClient();

	return useMutationAction({
		mutationOptions: () =>
			orpc.asset.saveMany.mutationOptions({
				...opts,
				onSuccess: async (...args) => {
					queryClient.invalidateQueries({
						queryKey: orpc.asset.key(),
					});

					try {
						await opts.onSuccess?.(...args);
					} catch (error) {
						console.error(
							"useSaveManyAssetsMutation onSuccess callback failed:",
							error,
						);
					}
				},
			}),
		messages: {
			loading: "Saving assets...",
			success: "Assets saved",
			error: "Failed to save assets",
		},
	});
};

export const useDeleteAssetsMutation = (
	opts: ReturnType<typeof orpc.asset.delete.mutationOptions> = {},
) => {
	const queryClient = useQueryClient();

	return useMutationAction({
		mutationOptions: () =>
			orpc.asset.delete.mutationOptions({
				...opts,
				onSuccess: async (...args) => {
					queryClient.invalidateQueries({
						queryKey: orpc.asset.key(),
					});

					try {
						await opts.onSuccess?.(...args);
					} catch (error) {
						console.error(
							"useDeleteAssetsMutation onSuccess callback failed:",
							error,
						);
					}
				},
			}),
		messages: {
			loading: "Deleting assets...",
			success: "Assets deleted",
			error: "Failed to delete assets",
		},
		confirm: (input) => {
			const count = input.refs.length;
			const plural = count === 1 ? "" : "s";

			return {
				title: `Delete Asset${plural}`,
				description: `Are you sure you want to delete ${count} asset${plural}? This action cannot be undone.`,
				confirmText: "Delete",
				cancelText: "Cancel",
			};
		},
	});
};
