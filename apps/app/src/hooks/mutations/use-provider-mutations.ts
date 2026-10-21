import { useRouter } from "@tanstack/react-router";
import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import {
	type DestructiveTarget,
	singleTargetName,
} from "@/hooks/mutations/destructive-target";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

export const useCreateProviderMutation = (
	opts: ReturnType<typeof orpc.provider.create.mutationOptions> = {},
) => {
	const router = useRouter();

	return useMutationAction({
		mutationOptions: () =>
			orpc.provider.create.mutationOptions({
				...opts,
				onSuccess: async (result, ...args) => {
					await router.navigate({
						to: "/app/providers/$providerId",
						params: {
							providerId: result.data.id,
						},
					});

					await opts.onSuccess?.(result, ...args);
				},
			}),
		messages: {
			loading: m.providers_create_toast_loading(),
			success: m.providers_create_toast_success(),
			error: m.providers_create_toast_error(),
		},
	});
};

export const useUpdateProviderMutation = (
	opts: ReturnType<typeof orpc.provider.update.mutationOptions> = {},
) => {
	return useMutationAction({
		mutationOptions: () => orpc.provider.update.mutationOptions(opts),
		messages: {
			loading: m.providers_update_toast_loading(),
			success: m.providers_update_toast_success(),
			error: m.providers_update_toast_error(),
		},
	});
};

export const useDeleteProvidersMutation = (
	opts: ReturnType<typeof orpc.provider.delete.mutationOptions> = {},
	target?: DestructiveTarget,
) => {
	return useMutationAction({
		mutationOptions: () => orpc.provider.delete.mutationOptions(opts),
		messages: {
			loading: ({ input }) =>
				m.providers_delete_toast_loading({
					count: input.refs.length,
				}),
			success: ({ input }) =>
				m.providers_delete_toast_success({
					count: input.refs.length,
				}),
			error: ({ input }) =>
				m.providers_delete_toast_error({
					count: input.refs.length,
				}),
		},
		confirm: (input) => {
			const count = input.refs.length;
			const name = singleTargetName(count, target);

			return {
				title: name
					? m.providers_delete_confirm_title_named({
							name,
						})
					: m.providers_delete_confirm_title({
							count,
						}),
				description: m.providers_delete_confirm_description({
					count,
				}),
				confirmText: m.providers_delete_confirm_button({
					count,
				}),
				cancelText: m.common_cancel_button(),
			};
		},
	});
};
