import { useDeleteAction } from "@/hooks/actions/use-delete-action";
import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import type { DestructiveTarget } from "@/hooks/mutations/destructive-target";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

export const useSaveAssetMutation = () => {
	return useMutationAction({
		mutationOptions: () => orpc.asset.save.mutationOptions(),
		messages: {
			loading: () => m.assets_save_toast_loading(),
			success: () => m.assets_save_toast_success(),
			error: () => m.assets_save_toast_error(),
		},
	});
};

export const useAddAssetToLibraryMutation = () => {
	return useMutationAction({
		mutationOptions: () => orpc.asset.addToLibrary.mutationOptions(),
		messages: {
			loading: () => m.assets_add_to_library_toast_loading(),
			success: () => m.assets_add_to_library_toast_success(),
			error: () => m.assets_add_to_library_toast_error(),
		},
	});
};

export const useDeleteAssetsMutation = (target?: DestructiveTarget) =>
	useDeleteAction({
		mutationOptions: () => orpc.asset.delete.mutationOptions(),
		copy: {
			loading: m.assets_delete_toast_loading,
			success: m.assets_delete_toast_success,
			error: m.assets_delete_toast_error,
			title: m.assets_delete_confirm_title,
			namedTitle: m.assets_delete_confirm_title_named,
			description: m.assets_delete_confirm_description,
			confirmText: m.assets_delete_confirm_button,
		},
		target,
	});

export const usePrepareAssetAgainMutation = () => {
	return useMutationAction({
		mutationOptions: () => orpc.asset.prepareAgain.mutationOptions(),
		messages: {
			loading: m.assets_prepare_again_toast_loading(),
			success: m.assets_prepare_again_toast_success(),
			error: m.assets_prepare_again_toast_error(),
		},
		confirm: {
			title: m.assets_prepare_again_confirm_title(),
			description: m.assets_prepare_again_confirm_description(),
			confirmText: m.assets_prepare_again_confirm_button(),
		},
	});
};

export const useGenerateAssetMetadataMutation = () =>
	useMutationAction({
		mutationOptions: () => orpc.asset.generateMetadata.mutationOptions(),
		messages: {
			loading: () => m.assets_metadata_generate_toast_loading(),
			success: () => m.assets_metadata_generate_toast_success(),
			error: () => m.assets_metadata_generate_toast_error(),
		},
	});

export const useDismissMetadataSuggestionMutation = () =>
	useMutationAction({
		mutationOptions: () =>
			orpc.asset.dismissMetadataSuggestion.mutationOptions(),
		messages: {
			loading: () => m.assets_metadata_dismiss_toast_loading(),
			success: () => m.assets_metadata_dismiss_toast_success(),
			error: () => m.assets_metadata_dismiss_toast_error(),
		},
	});

/** Generates metadata for every library asset that lacks it, after confirming `count`. */
export const useGenerateMissingMetadataMutation = (count: number) =>
	useMutationAction({
		mutationOptions: () => orpc.asset.generateMissingMetadata.mutationOptions(),
		messages: {
			loading: () => m.assets_metadata_backfill_toast_loading(),
			success: ({ data }) =>
				m.assets_metadata_backfill_toast_success({
					count: data.count,
				}),
			error: () => m.assets_metadata_backfill_toast_error(),
		},
		confirm: {
			title: m.assets_metadata_backfill_confirm_title(),
			description: m.assets_metadata_backfill_confirm_description({
				count,
			}),
			confirmText: m.assets_metadata_backfill_confirm_button(),
		},
	});
