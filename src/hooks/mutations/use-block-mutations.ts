import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import { orpc } from "@/lib/orpc/orpc";

export const useCreateBlockMutation = (
	opts: ReturnType<typeof orpc.block.create.mutationOptions> = {},
) => {
	const router = useRouter();
	const queryClient = useQueryClient();

	return useMutationAction({
		mutationOptions: () => {
			return orpc.block.create.mutationOptions({
				...opts,
				onSuccess: async (result, ...args) => {
					queryClient.invalidateQueries({
						queryKey: orpc.block.key(),
					});

					await router.navigate({
						to: "/app/hub/blocks/$blockId",
						params: { blockId: result.data.id },
					});

					try {
						await opts.onSuccess?.(result, ...args);
					} catch (error) {
						console.error(
							"useCreateBlockMutation onSuccess callback failed:",
							error,
						);
					}
				},
			});
		},
		messages: {
			loading: "Creating block...",
			success: "Block created successfully",
			error: "Failed to create block",
		},
	});
};

export const useUpdateBlockMutation = (
	opts: ReturnType<typeof orpc.block.update.mutationOptions> = {},
) => {
	const router = useRouter();
	const queryClient = useQueryClient();

	return useMutationAction({
		mutationOptions: () =>
			orpc.block.update.mutationOptions({
				...opts,
				onSuccess: async (...args) => {
					queryClient.invalidateQueries({
						queryKey: orpc.block.key(),
					});

					router.history.back();

					try {
						await opts.onSuccess?.(...args);
					} catch (error) {
						console.error(
							"useUpdateBlockMutation onSuccess callback failed:",
							error,
						);
					}
				},
			}),
		messages: {
			loading: "Updating block...",
			success: "Block updated successfully",
			error: "Failed to update block",
		},
	});
};

export const useDeleteBlocksMutation = (
	opts: ReturnType<typeof orpc.block.delete.mutationOptions> = {},
) => {
	const queryClient = useQueryClient();

	return useMutationAction({
		mutationOptions: () =>
			orpc.block.delete.mutationOptions({
				...opts,
				onSuccess: async (...args) => {
					queryClient.invalidateQueries({
						queryKey: orpc.block.key(),
					});

					try {
						await opts.onSuccess?.(...args);
					} catch (error) {
						console.error(
							"useDeleteBlocksMutation onSuccess callback failed:",
							error,
						);
					}
				},
			}),
		messages: {
			loading: "Deleting block(s)...",
			success: "Block(s) deleted successfully",
			error: "Failed to delete block(s)",
		},
		confirm: (input) => {
			const count = input.refs.length;
			const plural = count === 1 ? "" : "s";

			return {
				title: `Delete Block${plural}`,
				description: `Are you sure you want to delete ${count} block${plural}? This action cannot be undone.`,
				confirmText: "Delete",
				cancelText: "Cancel",
			};
		},
	});
};
