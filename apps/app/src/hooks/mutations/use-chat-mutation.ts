import { useQueryClient } from "@tanstack/react-query";
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

const CHAT_NOUNS = {
	noun: "chat",
	nounPlural: "chats",
};

export const useUpdateChatMutation = (
	opts: ReturnType<typeof orpc.chat.update.mutationOptions> = {},
) => {
	const queryClient = useQueryClient();

	return useMutationAction({
		mutationOptions: () =>
			orpc.chat.update.mutationOptions({
				...opts,
				onSuccess: async (...args) => {
					queryClient.invalidateQueries({
						queryKey: orpc.chat.key(),
					});

					try {
						await opts.onSuccess?.(...args);
					} catch (error) {
						console.error(
							"useUpdateChatMutation onSuccess callback failed:",
							error,
						);
					}
				},
			}),
		messages: {
			loading: "Updating chat...",
			success: "Chat updated successfully",
			error: "Failed to update chat",
		},
	});
};

export const useDeleteChatsMutation = (
	opts: ReturnType<typeof orpc.chat.delete.mutationOptions> = {},
	target?: DestructiveTarget,
) => {
	const queryClient = useQueryClient();

	return useMutationAction({
		mutationOptions: () =>
			orpc.chat.delete.mutationOptions({
				...opts,
				onSuccess: async (...args) => {
					queryClient.invalidateQueries({
						queryKey: orpc.chat.key(),
					});

					try {
						await opts.onSuccess?.(...args);
					} catch (error) {
						console.error(
							"useDeleteChatsMutation onSuccess callback failed:",
							error,
						);
					}
				},
			}),
		messages: {
			loading: ({ input }) =>
				describeProgress("Deleting", input.refs.length, CHAT_NOUNS, target),
			success: ({ input }) =>
				describeOutcome(input.refs.length, CHAT_NOUNS, "deleted", target),
			error: ({ input }) =>
				describeFailure(input.refs.length, CHAT_NOUNS, "deleted", target),
		},
		confirm: (input) => {
			const count = input.refs.length;

			return {
				title: `Delete ${describeTarget(count, CHAT_NOUNS, target)}?`,
				description:
					count === 1
						? "Its messages and branches are removed for good."
						: "Their messages and branches are removed for good.",
				confirmText: describeAction("Delete", count, CHAT_NOUNS, target),
				cancelText: "Cancel",
			};
		},
	});
};
