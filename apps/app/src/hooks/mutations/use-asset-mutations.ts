import { useQueryClient } from "@tanstack/react-query";
import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import {
	type DestructiveTarget,
	describeAction,
	describeFailure,
	describeOutcome,
	describeProgress,
	describeTarget,
} from "@/hooks/mutations/destructive-copy";
import { orpc } from "@/lib/orpc/orpc";

const ASSET_NOUNS = {
	noun: "asset",
	nounPlural: "assets",
};

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
	target?: DestructiveTarget,
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
			loading: ({ input }) =>
				describeProgress("Deleting", input.refs.length, ASSET_NOUNS, target),
			success: ({ input }) =>
				describeOutcome(input.refs.length, ASSET_NOUNS, "deleted", target),
			error: ({ input }) =>
				describeFailure(input.refs.length, ASSET_NOUNS, "deleted", target),
		},
		confirm: (input) => {
			const count = input.refs.length;

			return {
				title: `Delete ${describeTarget(count, ASSET_NOUNS, target)}?`,
				description:
					count === 1
						? "Repositories built on it lose the material, and answers can no longer cite it."
						: "Repositories built on them lose the material, and answers can no longer cite them.",
				confirmText: describeAction("Delete", count, ASSET_NOUNS, target),
				cancelText: "Cancel",
			};
		},
	});
};
