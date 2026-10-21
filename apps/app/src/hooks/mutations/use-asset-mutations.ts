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
