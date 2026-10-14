import { useQueryClient } from "@tanstack/react-query";
import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

export const useCreateJobMutation = (
	opts: ReturnType<typeof orpc.job.create.mutationOptions> = {},
) => {
	const queryClient = useQueryClient();

	return useMutationAction({
		mutationOptions: () =>
			orpc.job.create.mutationOptions({
				...opts,
				onSuccess: async (...args) => {
					queryClient.invalidateQueries({
						queryKey: orpc.job.key(),
					});

					try {
						await opts.onSuccess?.(...args);
					} catch (error) {
						console.error(
							"useCreateJobMutation onSuccess callback failed:",
							error,
						);
					}
				},
			}),
		messages: {
			loading: m.jobs_create_toast_loading(),
			success: m.jobs_create_toast_success(),
			error: m.jobs_create_toast_error(),
		},
		confirm: (input) => ({
			title: m.jobs_create_confirm_title(),
			description: m.jobs_create_confirm_description({
				jobRunner: input.jobRunner,
			}),
			confirmText: m.jobs_create_confirm_button(),
		}),
	});
};

export const useRetryProcessingMutation = () => {
	const queryClient = useQueryClient();

	return useMutationAction({
		mutationOptions: () =>
			orpc.job.retryProcessing.mutationOptions({
				onSuccess: () => {
					queryClient.invalidateQueries({
						queryKey: orpc.job.key(),
					});
					queryClient.invalidateQueries({
						queryKey: orpc.asset.key(),
					});
				},
			}),
		messages: {
			loading: m.jobs_retry_processing_toast_loading(),
			success: m.jobs_retry_processing_toast_success(),
			error: m.jobs_retry_processing_toast_error(),
		},
	});
};

export const useReprocessAssetMutation = () => {
	const queryClient = useQueryClient();

	return useMutationAction({
		mutationOptions: () =>
			orpc.job.retryProcessing.mutationOptions({
				onSuccess: () => {
					queryClient.invalidateQueries({
						queryKey: orpc.job.key(),
					});
					queryClient.invalidateQueries({
						queryKey: orpc.asset.key(),
					});
				},
			}),
		messages: {
			loading: m.jobs_reprocess_toast_loading(),
			success: m.jobs_reprocess_toast_success(),
			error: m.jobs_reprocess_toast_error(),
		},
		confirm: {
			title: m.jobs_reprocess_confirm_title(),
			description: m.jobs_reprocess_confirm_description(),
			confirmText: m.jobs_reprocess_confirm_button(),
		},
	});
};

export const useRetryVectorizationMutation = () => {
	const queryClient = useQueryClient();

	return useMutationAction({
		mutationOptions: () =>
			orpc.job.retryVectorization.mutationOptions({
				onSuccess: () => {
					queryClient.invalidateQueries({
						queryKey: orpc.job.key(),
					});
				},
			}),
		messages: {
			loading: m.jobs_retry_vectorization_toast_loading(),
			success: m.jobs_retry_vectorization_toast_success(),
			error: m.jobs_retry_vectorization_toast_error(),
		},
	});
};
