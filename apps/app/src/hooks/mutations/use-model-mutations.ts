import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import {
	type DestructiveTarget,
	singleTargetName,
} from "@/hooks/mutations/destructive-target";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

export const useCreateModelMutation = (
	opts: ReturnType<typeof orpc.model.create.mutationOptions> = {},
) => {
	const router = useRouter();
	const queryClient = useQueryClient();

	return useMutationAction({
		mutationOptions: () =>
			orpc.model.create.mutationOptions({
				...opts,
				onSuccess: async (result, ...args) => {
					queryClient.invalidateQueries({
						queryKey: orpc.model.key(),
					});

					await router.navigate({
						to: "/app/models/$modelId",
						params: {
							modelId: result.data.id,
						},
					});

					try {
						await opts.onSuccess?.(result, ...args);
					} catch (error) {
						console.error(
							"useCreateModelMutation onSuccess callback failed:",
							error,
						);
					}
				},
			}),
		messages: {
			loading: m.models_create_toast_loading(),
			success: m.models_create_toast_success(),
			error: m.models_create_toast_error(),
		},
	});
};

export const useUpdateModelMutation = (
	opts: ReturnType<typeof orpc.model.update.mutationOptions> = {},
) => {
	const router = useRouter();
	const queryClient = useQueryClient();

	return useMutationAction({
		mutationOptions: () =>
			orpc.model.update.mutationOptions({
				...opts,
				onSuccess: async (...args) => {
					queryClient.invalidateQueries({
						queryKey: orpc.model.key(),
					});

					router.history.back();

					try {
						await opts.onSuccess?.(...args);
					} catch (error) {
						console.error(
							"useUpdateModelMutation onSuccess callback failed:",
							error,
						);
					}
				},
			}),
		messages: {
			loading: m.models_update_toast_loading(),
			success: m.models_update_toast_success(),
			error: m.models_update_toast_error(),
		},
	});
};

export const useDeleteModelsMutation = (
	opts: ReturnType<typeof orpc.model.delete.mutationOptions> = {},
	target?: DestructiveTarget,
) => {
	const queryClient = useQueryClient();

	return useMutationAction({
		mutationOptions: () =>
			orpc.model.delete.mutationOptions({
				...opts,
				onSuccess: async (...args) => {
					queryClient.invalidateQueries({
						queryKey: orpc.model.key(),
					});

					try {
						await opts.onSuccess?.(...args);
					} catch (error) {
						console.error(
							"useDeleteModelsMutation onSuccess callback failed:",
							error,
						);
					}
				},
			}),
		messages: {
			loading: ({ input }) =>
				m.models_delete_toast_loading({
					count: input.refs.length,
				}),
			success: ({ input }) =>
				m.models_delete_toast_success({
					count: input.refs.length,
				}),
			error: ({ input }) =>
				m.models_delete_toast_error({
					count: input.refs.length,
				}),
		},
		confirm: (input) => {
			const count = input.refs.length;
			const name = singleTargetName(count, target);

			return {
				title: name
					? m.models_delete_confirm_title_named({
							name,
						})
					: m.models_delete_confirm_title({
							count,
						}),
				description: m.models_delete_confirm_description({
					count,
				}),
				confirmText: m.models_delete_confirm_button({
					count,
				}),
				cancelText: m.common_cancel_button(),
			};
		},
	});
};
