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

	return useMutationAction({
		mutationOptions: () =>
			orpc.model.create.mutationOptions({
				...opts,
				onSuccess: async (result, ...args) => {
					await router.navigate({
						to: "/app/models/$modelId",
						params: {
							modelId: result.data.id,
						},
					});

					await opts.onSuccess?.(result, ...args);
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
	return useMutationAction({
		mutationOptions: () => orpc.model.update.mutationOptions(opts),
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
	return useMutationAction({
		mutationOptions: () => orpc.model.delete.mutationOptions(opts),
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
