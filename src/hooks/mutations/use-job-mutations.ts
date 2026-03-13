import { useQueryClient } from "@tanstack/react-query";
import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import { orpc } from "@/lib/orpc/orpc";

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
			loading: "Creating job...",
			success: "Job created",
			error: "Failed to create job",
		},
		confirm: (input) => ({
			title: "Create Job",
			description: `Are you sure you want to create a job for '${input.jobRunner}'?`,
			confirmText: "Yes, create it",
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
			loading: "Retrying processing...",
			success: "Processing job queued",
			error: "Failed to retry processing",
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
			loading: "Retrying vectorization...",
			success: "Vectorization job queued",
			error: "Failed to retry vectorization",
		},
	});
};
