import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import {
	type DestructiveTarget,
	singleTargetName,
} from "@/hooks/mutations/destructive-target";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

export const useSaveAssetMutation = (
	opts: ReturnType<typeof orpc.asset.save.mutationOptions> = {},
) => {
	return useMutationAction({
		mutationOptions: () => orpc.asset.save.mutationOptions(opts),
		messages: {
			loading: () => m.assets_save_toast_loading(),
			success: () => m.assets_save_toast_success(),
			error: () => m.assets_save_toast_error(),
		},
	});
};

export const useAddAssetToLibraryMutation = (
	opts: ReturnType<typeof orpc.asset.addToLibrary.mutationOptions> = {},
) => {
	return useMutationAction({
		mutationOptions: () => orpc.asset.addToLibrary.mutationOptions(opts),
		messages: {
			loading: () => m.assets_add_to_library_toast_loading(),
			success: () => m.assets_add_to_library_toast_success(),
			error: () => m.assets_add_to_library_toast_error(),
		},
	});
};

export const useDeleteAssetsMutation = (
	opts: ReturnType<typeof orpc.asset.delete.mutationOptions> = {},
	target?: DestructiveTarget,
) => {
	return useMutationAction({
		mutationOptions: () => orpc.asset.delete.mutationOptions(opts),
		messages: {
			loading: ({ input }) =>
				m.assets_delete_toast_loading({
					count: input.refs.length,
				}),
			success: ({ input }) =>
				m.assets_delete_toast_success({
					count: input.refs.length,
				}),
			error: ({ input }) =>
				m.assets_delete_toast_error({
					count: input.refs.length,
				}),
		},
		confirm: (input) => {
			const count = input.refs.length;
			const name = singleTargetName(count, target);

			return {
				title: name
					? m.assets_delete_confirm_title_named({
							name,
						})
					: m.assets_delete_confirm_title({
							count,
						}),
				description: m.assets_delete_confirm_description({
					count,
				}),
				confirmText: m.assets_delete_confirm_button({
					count,
				}),
				cancelText: m.common_cancel_button(),
			};
		},
	});
};

export const useReprocessAssetMutation = () => {
	return useMutationAction({
		mutationOptions: () => orpc.asset.reprocess.mutationOptions(),
		messages: {
			loading: m.assets_reprocess_toast_loading(),
			success: m.assets_reprocess_toast_success(),
			error: m.assets_reprocess_toast_error(),
		},
		confirm: {
			title: m.assets_reprocess_confirm_title(),
			description: m.assets_reprocess_confirm_description(),
			confirmText: m.assets_reprocess_confirm_button(),
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
