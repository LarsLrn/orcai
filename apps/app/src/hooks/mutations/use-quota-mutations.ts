import { useRouter } from "@tanstack/react-router";
import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

export const useCreateQuotaPoolMutation = (
	opts: ReturnType<typeof orpc.quota.create.mutationOptions> = {},
) => {
	const router = useRouter();

	return useMutationAction({
		mutationOptions: () =>
			orpc.quota.create.mutationOptions({
				...opts,
				onSuccess: async (result, ...args) => {
					await router.navigate({
						to: "/app/quotas/$quotaPoolId",
						params: {
							quotaPoolId: result.data.id,
						},
					});

					await opts.onSuccess?.(result, ...args);
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
	return useMutationAction({
		mutationOptions: () => orpc.quota.update.mutationOptions(opts),
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
	return useMutationAction({
		mutationOptions: () => orpc.quota.deactivate.mutationOptions(opts),
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
