import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

export const useCreateQuotaPoolMutation = (
	opts: ReturnType<typeof orpc.quota.create.mutationOptions> = {},
) => {
	const router = useRouter();
	const queryClient = useQueryClient();

	return useMutationAction({
		mutationOptions: () =>
			orpc.quota.create.mutationOptions({
				...opts,
				onSuccess: async (result, ...args) => {
					queryClient.invalidateQueries({
						queryKey: orpc.quota.key(),
					});

					await router.navigate({
						to: "/app/quotas/$quotaPoolId",
						params: {
							quotaPoolId: result.data.id,
						},
					});

					try {
						await opts.onSuccess?.(result, ...args);
					} catch (error) {
						console.error(
							"useCreateQuotaPoolMutation onSuccess callback failed:",
							error,
						);
					}
				},
			}),
		messages: {
			loading: m.quotas_create_toast_loading(),
			success: m.quotas_create_toast_success(),
			error: m.quotas_create_toast_error(),
		},
	});
};

export const useUpdateQuotaPoolMutation = (
	opts: ReturnType<typeof orpc.quota.update.mutationOptions> = {},
) => {
	const queryClient = useQueryClient();

	return useMutationAction({
		mutationOptions: () =>
			orpc.quota.update.mutationOptions({
				...opts,
				onSuccess: async (...args) => {
					queryClient.invalidateQueries({
						queryKey: orpc.quota.key(),
					});

					try {
						await opts.onSuccess?.(...args);
					} catch (error) {
						console.error(
							"useUpdateQuotaPoolMutation onSuccess callback failed:",
							error,
						);
					}
				},
			}),
		messages: {
			loading: m.quotas_update_toast_loading(),
			success: m.quotas_update_toast_success(),
			error: m.quotas_update_toast_error(),
		},
	});
};

export const useDeactivateQuotaPoolMutation = (
	opts: ReturnType<typeof orpc.quota.deactivate.mutationOptions> = {},
	poolName?: string,
) => {
	const queryClient = useQueryClient();

	return useMutationAction({
		mutationOptions: () =>
			orpc.quota.deactivate.mutationOptions({
				...opts,
				onSuccess: async (...args) => {
					queryClient.invalidateQueries({
						queryKey: orpc.quota.key(),
					});

					try {
						await opts.onSuccess?.(...args);
					} catch (error) {
						console.error(
							"useDeactivateQuotaPoolMutation onSuccess callback failed:",
							error,
						);
					}
				},
			}),
		messages: {
			loading: m.quotas_deactivate_toast_loading(),
			success: m.quotas_deactivate_toast_success(),
			error: m.quotas_deactivate_toast_error(),
		},
		confirm: {
			title: poolName?.trim()
				? m.quotas_deactivate_confirm_title_named({
						name: poolName.trim(),
					})
				: m.quotas_deactivate_confirm_title(),
			description: m.quotas_deactivate_confirm_description(),
			confirmText: m.quotas_deactivate_confirm_button(),
			cancelText: m.common_cancel_button(),
		},
	});
};
