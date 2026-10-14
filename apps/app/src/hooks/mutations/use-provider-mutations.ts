import { useQueryClient } from "@tanstack/react-query";
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
	const queryClient = useQueryClient();

	return useMutationAction({
		mutationOptions: () =>
			orpc.provider.create.mutationOptions({
				...opts,
				onSuccess: async (result, ...args) => {
					queryClient.invalidateQueries({
						queryKey: orpc.provider.key(),
					});

					await router.navigate({
						to: "/app/providers/$providerId",
						params: {
							providerId: result.data.id,
						},
					});

					try {
						await opts.onSuccess?.(result, ...args);
					} catch (error) {
						console.error(
							"useCreateProviderMutation onSuccess callback failed:",
							error,
						);
					}
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
	const router = useRouter();
	const queryClient = useQueryClient();

	return useMutationAction({
		mutationOptions: () =>
			orpc.provider.update.mutationOptions({
				...opts,
				onSuccess: async (...args) => {
					queryClient.invalidateQueries({
						queryKey: orpc.provider.key(),
					});

					router.history.back();

					try {
						await opts.onSuccess?.(...args);
					} catch (error) {
						console.error(
							"useUpdateProviderMutation onSuccess callback failed:",
							error,
						);
					}
				},
			}),
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
	const queryClient = useQueryClient();

	return useMutationAction({
		mutationOptions: () =>
			orpc.provider.delete.mutationOptions({
				...opts,
				onSuccess: async (...args) => {
					queryClient.invalidateQueries({
						queryKey: orpc.provider.key(),
					});

					try {
						await opts.onSuccess?.(...args);
					} catch (error) {
						console.error(
							"useDeleteProvidersMutation onSuccess callback failed:",
							error,
						);
					}
				},
			}),
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
