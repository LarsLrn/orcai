import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import { orpc } from "@/lib/orpc/orpc";

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
			loading: "Creating quota pool...",
			success: "Quota pool created",
			error: "Failed to create quota pool",
		},
	});
};

export const useUpdateQuotaPoolMutation = (
	opts: ReturnType<typeof orpc.quota.update.mutationOptions> = {},
) => {
	const router = useRouter();
	const queryClient = useQueryClient();

	return useMutationAction({
		mutationOptions: () =>
			orpc.quota.update.mutationOptions({
				...opts,
				onSuccess: async (...args) => {
					queryClient.invalidateQueries({
						queryKey: orpc.quota.key(),
					});

					router.history.back();

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
			loading: "Updating quota pool...",
			success: "Quota pool updated",
			error: "Failed to update quota pool",
		},
	});
};

export const useDeactivateQuotaPoolMutation = (
	opts: ReturnType<typeof orpc.quota.deactivate.mutationOptions> = {},
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
			loading: "Deactivating quota pool...",
			success: "Quota pool deactivated",
			error: "Failed to deactivate quota pool",
		},
		confirm: {
			title: "Deactivate pool",
			description: "New reservations will be blocked for this pool.",
			confirmText: "Deactivate",
			cancelText: "Cancel",
		},
	});
};
