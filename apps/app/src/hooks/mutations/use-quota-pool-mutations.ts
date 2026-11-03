import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

export const useCreateQuotaPoolMutation = () =>
	useMutationAction({
		mutationOptions: () => orpc.quotaPool.create.mutationOptions(),
		messages: {
			loading: m.quota_pools_create_toast_loading(),
			success: m.quota_pools_create_toast_success(),
			error: m.quota_pools_create_toast_error(),
		},
	});

export const useUpdateQuotaPoolMutation = () => {
	return useMutationAction({
		mutationOptions: () => orpc.quotaPool.update.mutationOptions(),
		messages: {
			loading: m.quota_pools_update_toast_loading(),
			success: m.quota_pools_update_toast_success(),
			error: m.quota_pools_update_toast_error(),
		},
	});
};

export const useDeactivateQuotaPoolMutation = (poolName?: string) => {
	return useMutationAction({
		mutationOptions: () => orpc.quotaPool.deactivate.mutationOptions(),
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
		},
	});
};
