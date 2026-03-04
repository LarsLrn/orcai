import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import { useUmami } from "@/hooks/use-umami";
import { orpc } from "@/lib/orpc/orpc";

export const useCreateChatMutation = (
	opts: ReturnType<typeof orpc.chat.create.mutationOptions> = {},
) => {
	const navigate = useNavigate();
	const { trackEvent } = useUmami();

	const queryClient = useQueryClient();

	return useMutationAction({
		mutationOptions: () =>
			orpc.chat.create.mutationOptions({
				...opts,
				onSuccess: async (result, ...args) => {
					queryClient.invalidateQueries({
						queryKey: orpc.chat.key(),
					});

					await navigate({
						to: "/app/chat/$chatId",
						params: {
							chatId: result.data.id,
						},
					});

					trackEvent("chat-create", {
						chatId: result.data.id,
					});

					try {
						await opts.onSuccess?.(result, ...args);
					} catch (error) {
						console.error(
							"useCreateChatMutation onSuccess callback failed:",
							error,
						);
					}
				},
			}),
		messages: {
			loading: "Creating new chat...",
			success: "New chat created",
			error: "Failed to create chat",
		},
	});
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
			loading: "Deleting chats...",
			success: "Chats deleted",
			error: "Failed to delete chats",
		},
		confirm: (input) => {
			const count = input.refs.length;
			const plural = count === 1 ? "" : "s";

			return {
				title: `Delete Chat${plural}`,
				description: `Are you sure you want to delete ${count} chat${plural}? This action cannot be undone.`,
				confirmText: "Delete",
				cancelText: "Cancel",
			};
		},
	});
};
