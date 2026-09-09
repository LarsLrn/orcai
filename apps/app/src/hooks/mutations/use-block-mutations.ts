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

const BLOCK_NOUNS = {
	noun: "block",
	nounPlural: "blocks",
};

export const useCreateBlockMutation = (
	opts: ReturnType<typeof orpc.block.create.mutationOptions> = {},
) => {
	const router = useRouter();
	const queryClient = useQueryClient();

	return useMutationAction({
		mutationOptions: () => {
			return orpc.block.create.mutationOptions({
				...opts,
				onSuccess: async (result, ...args) => {
					queryClient.invalidateQueries({
						queryKey: orpc.block.key(),
					});

					await router.navigate({
						to: "/app/hub/blocks/$blockId",
						params: {
							blockId: result.data.id,
						},
					});

					try {
						await opts.onSuccess?.(result, ...args);
					} catch (error) {
						console.error(
							"useCreateBlockMutation onSuccess callback failed:",
							error,
						);
					}
				},
			});
		},
		messages: {
			loading: "Creating block...",
			success: "Block created successfully",
			error: "Failed to create block",
		},
	});
};

export const useUpdateBlockMutation = (
	opts: ReturnType<typeof orpc.block.update.mutationOptions> = {},
) => {
	const router = useRouter();
	const queryClient = useQueryClient();

	return useMutationAction({
		mutationOptions: () =>
			orpc.block.update.mutationOptions({
				...opts,
				onSuccess: async (...args) => {
					queryClient.invalidateQueries({
						queryKey: orpc.block.key(),
					});

					router.history.back();

					try {
						await opts.onSuccess?.(...args);
					} catch (error) {
						console.error(
							"useUpdateBlockMutation onSuccess callback failed:",
							error,
						);
					}
				},
			}),
		messages: {
			loading: "Updating block...",
			success: "Block updated successfully",
			error: "Failed to update block",
		},
	});
};

export const useDeleteBlocksMutation = (
	opts: ReturnType<typeof orpc.block.delete.mutationOptions> = {},
	target?: DestructiveTarget,
) => {
	const queryClient = useQueryClient();

	return useMutationAction({
		mutationOptions: () =>
			orpc.block.delete.mutationOptions({
				...opts,
				onSuccess: async (...args) => {
					queryClient.invalidateQueries({
						queryKey: orpc.block.key(),
					});

					try {
						await opts.onSuccess?.(...args);
					} catch (error) {
						console.error(
							"useDeleteBlocksMutation onSuccess callback failed:",
							error,
						);
					}
				},
			}),
		messages: {
			loading: ({ input }) =>
				describeProgress("Deleting", input.refs.length, BLOCK_NOUNS, target),
			success: ({ input }) =>
				describeOutcome(input.refs.length, BLOCK_NOUNS, "deleted", target),
			error: ({ input }) =>
				describeFailure(input.refs.length, BLOCK_NOUNS, "deleted", target),
		},
		confirm: (input) => {
			const count = input.refs.length;

			return {
				title: `Delete ${describeTarget(count, BLOCK_NOUNS, target)}?`,
				description:
					count === 1
						? "Bots and chats that use it lose it, and its links to indexed material go with it."
						: "Bots and chats that use them lose them, and their links to indexed material go with them.",
				confirmText: describeAction("Delete", count, BLOCK_NOUNS, target),
				cancelText: "Cancel",
			};
		},
	});
};

export const useSetBlockStatusMutation = (
	opts: ReturnType<typeof orpc.block.update.mutationOptions> = {},
) => {
	const queryClient = useQueryClient();

	return useMutationAction({
		mutationOptions: () =>
			orpc.block.update.mutationOptions({
				...opts,
				onSuccess: async (...args) => {
					queryClient.invalidateQueries({
						queryKey: orpc.block.key(),
					});

					try {
						await opts.onSuccess?.(...args);
					} catch (error) {
						console.error(
							"useSetBlockStatusMutation onSuccess callback failed:",
							error,
						);
					}
				},
			}),
		messages: {
			loading: "Updating block status...",
			success: ({ input }) =>
				input.status === "ready"
					? "Block marked as ready"
					: "Block moved to draft",
			error: "Failed to update block status",
		},
	});
};

export const useCreateBlockInlineMutation = (
	opts: ReturnType<typeof orpc.block.create.mutationOptions> = {},
) => {
	const queryClient = useQueryClient();

	return useMutationAction({
		mutationOptions: () =>
			orpc.block.create.mutationOptions({
				...opts,
				onSuccess: async (...args) => {
					queryClient.invalidateQueries({
						queryKey: orpc.block.key(),
					});

					try {
						await opts.onSuccess?.(...args);
					} catch (error) {
						console.error(
							"useCreateBlockInlineMutation onSuccess callback failed:",
							error,
						);
					}
				},
			}),
		messages: {
			loading: "Creating block...",
			success: "Block created",
			error: "Failed to create block",
		},
	});
};

export const useUpdateBlockInlineMutation = (
	opts: ReturnType<typeof orpc.block.update.mutationOptions> = {},
) => {
	const queryClient = useQueryClient();

	return useMutationAction({
		mutationOptions: () =>
			orpc.block.update.mutationOptions({
				...opts,
				onSuccess: async (...args) => {
					queryClient.invalidateQueries({
						queryKey: orpc.block.key(),
					});

					try {
						await opts.onSuccess?.(...args);
					} catch (error) {
						console.error(
							"useUpdateBlockInlineMutation onSuccess callback failed:",
							error,
						);
					}
				},
			}),
		messages: {
			loading: "Updating block...",
			success: "Block updated",
			error: "Failed to update block",
		},
	});
};
