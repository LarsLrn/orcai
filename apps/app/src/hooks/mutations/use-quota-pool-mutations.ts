import { useRouter } from "@tanstack/react-router";
import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

export const useCreateQuotaPoolMutation = (
	opts: ReturnType<typeof orpc.quotaPool.create.mutationOptions> = {},
) => {
	const router = useRouter();

	return useMutationAction({
		mutationOptions: () =>
			orpc.quotaPool.create.mutationOptions({
				...opts,
				onSuccess: async (result, ...args) => {
					await router.navigate({
						to: "/app/quota-pools/$quotaPoolId",
						params: {
							quotaPoolId: result.data.id,
						},
					});

					await opts.onSuccess?.(result, ...args);
				},
			}),
		messages: {
			loading: m.quota_pools_create_toast_loading(),
			success: m.quota_pools_create_toast_success(),
			error: m.quota_pools_create_toast_error(),
		},
	});
};

export const useUpdateQuotaPoolMutation = (
	opts: ReturnType<typeof orpc.quotaPool.update.mutationOptions> = {},
) => {
	return useMutationAction({
		mutationOptions: () => orpc.quotaPool.update.mutationOptions(opts),
		messages: {
			loading: m.quota_pools_update_toast_loading(),
			success: m.quota_pools_update_toast_success(),
			error: m.quota_pools_update_toast_error(),
		},
	});
};

export const useDeactivateQuotaPoolMutation = (
	opts: ReturnType<typeof orpc.quotaPool.deactivate.mutationOptions> = {},
	poolName?: string,
) => {
	return useMutationAction({
		mutationOptions: () => orpc.quotaPool.deactivate.mutationOptions(opts),
		messages: {
			loading: m.quota_pools_deactivate_toast_loading(),
			success: m.quota_pools_deactivate_toast_success(),
			error: m.quota_pools_deactivate_toast_error(),
		},
		confirm: {
			title: poolName?.trim()
				? m.quota_pools_deactivate_confirm_title_named({
						name: poolName.trim(),
					})
				: m.quota_pools_deactivate_confirm_title(),
			description: m.quota_pools_deactivate_confirm_description(),
			confirmText: m.quota_pools_deactivate_confirm_button(),
			cancelText: m.common_cancel_button(),
		},
	});
};
