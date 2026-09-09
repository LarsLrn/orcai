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

const MODEL_NOUNS = {
	noun: "model",
	nounPlural: "models",
};

export const useCreateModelMutation = (
	opts: ReturnType<typeof orpc.model.create.mutationOptions> = {},
) => {
	const router = useRouter();
	const queryClient = useQueryClient();

	return useMutationAction({
		mutationOptions: () =>
			orpc.model.create.mutationOptions({
				...opts,
				onSuccess: async (result, ...args) => {
					queryClient.invalidateQueries({
						queryKey: orpc.model.key(),
					});

					await router.navigate({
						to: "/app/models/$modelId",
						params: {
							modelId: result.data.id,
						},
					});

					try {
						await opts.onSuccess?.(result, ...args);
					} catch (error) {
						console.error(
							"useCreateModelMutation onSuccess callback failed:",
							error,
						);
					}
				},
			}),
		messages: {
			loading: "Creating model...",
			success: "Model created successfully",
			error: "Failed to create model",
		},
	});
};

export const useUpdateModelMutation = (
	opts: ReturnType<typeof orpc.model.update.mutationOptions> = {},
) => {
	const router = useRouter();
	const queryClient = useQueryClient();

	return useMutationAction({
		mutationOptions: () =>
			orpc.model.update.mutationOptions({
				...opts,
				onSuccess: async (...args) => {
					queryClient.invalidateQueries({
						queryKey: orpc.model.key(),
					});

					router.history.back();

					try {
						await opts.onSuccess?.(...args);
					} catch (error) {
						console.error(
							"useUpdateModelMutation onSuccess callback failed:",
							error,
						);
					}
				},
			}),
		messages: {
			loading: "Updating model...",
			success: "Model updated successfully",
			error: "Failed to update model",
		},
	});
};

export const useDeleteModelsMutation = (
	opts: ReturnType<typeof orpc.model.delete.mutationOptions> = {},
	target?: DestructiveTarget,
) => {
	const queryClient = useQueryClient();

	return useMutationAction({
		mutationOptions: () =>
			orpc.model.delete.mutationOptions({
				...opts,
				onSuccess: async (...args) => {
					queryClient.invalidateQueries({
						queryKey: orpc.model.key(),
					});

					try {
						await opts.onSuccess?.(...args);
					} catch (error) {
						console.error(
							"useDeleteModelsMutation onSuccess callback failed:",
							error,
						);
					}
				},
			}),
		messages: {
			loading: ({ input }) =>
				describeProgress("Deleting", input.refs.length, MODEL_NOUNS, target),
			success: ({ input }) =>
				describeOutcome(input.refs.length, MODEL_NOUNS, "deleted", target),
			error: ({ input }) =>
				describeFailure(input.refs.length, MODEL_NOUNS, "deleted", target),
		},
		confirm: (input) => {
			const count = input.refs.length;

			return {
				title: `Delete ${describeTarget(count, MODEL_NOUNS, target)}?`,
				description:
					count === 1
						? "Chats set to it lose their model choice, and quota pools scoped to it fall back to the whole provider."
						: "Chats set to them lose their model choice, and quota pools scoped to them fall back to the whole provider.",
				confirmText: describeAction("Delete", count, MODEL_NOUNS, target),
				cancelText: "Cancel",
			};
		},
	});
};
