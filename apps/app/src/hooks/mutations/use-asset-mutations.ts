import { useQueryClient } from "@tanstack/react-query";
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
			loading: () => m.assets_save_toast_loading(),
			success: () => m.assets_save_toast_success(),
			error: () => m.assets_save_toast_error(),
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
			loading: () => m.assets_save_many_toast_loading(),
			success: () => m.assets_save_many_toast_success(),
			error: () => m.assets_save_many_toast_error(),
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
