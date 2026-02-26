import { useRouter } from "@tanstack/react-router";
import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import { orpc } from "@/lib/orpc/orpc";

export const useAssetMutations = () => {
	const router = useRouter();

	const updateAsset = useMutationAction({
		mutationOptions: orpc.asset.update.mutationOptions,
		messages: {
			loading: "Updating asset...",
			success: "Asset updated successfully",
			error: "Failed to update asset",
		},
		onSuccess: () => router.history.back(),
	});

	const deleteAssets = useMutationAction({
		mutationOptions: orpc.asset.delete.mutationOptions,
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

	return {
		updateAsset,
		deleteAssets,
	};
};
