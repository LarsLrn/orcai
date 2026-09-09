import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import {
	type DestructiveTarget,
	describeAction,
	describeFailure,
	describeOutcome,
	describeProgress,
	describeTarget,
} from "@/hooks/mutations/destructive-copy";
import { orpc } from "@/lib/orpc/orpc";

const PROVIDER_NOUNS = {
	noun: "provider",
	nounPlural: "providers",
};

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
			loading: "Creating provider...",
			success: "Provider created successfully",
			error: "Failed to create provider",
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
			loading: "Updating provider...",
			success: "Provider updated successfully",
			error: "Failed to update provider",
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
				describeProgress("Deleting", input.refs.length, PROVIDER_NOUNS, target),
			success: ({ input }) =>
				describeOutcome(input.refs.length, PROVIDER_NOUNS, "deleted", target),
			error: ({ input }) =>
				describeFailure(input.refs.length, PROVIDER_NOUNS, "deleted", target),
		},
		confirm: (input) => {
			const count = input.refs.length;

			return {
				title: `Delete ${describeTarget(count, PROVIDER_NOUNS, target)}?`,
				description:
					count === 1
						? "Its models and quota pools are deleted with it."
						: "Their models and quota pools are deleted with them.",
				confirmText: describeAction("Delete", count, PROVIDER_NOUNS, target),
				cancelText: "Cancel",
			};
		},
	});
};
