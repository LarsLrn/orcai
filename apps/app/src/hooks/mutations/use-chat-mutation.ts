import type { ChatKind } from "@orcai/schema";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useDeleteAction } from "@/hooks/actions/use-delete-action";
import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import type { DestructiveTarget } from "@/hooks/mutations/destructive-target";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

export const useUpdateChatMutation = () => {
	return useMutationAction({
		mutationOptions: () => orpc.chat.update.mutationOptions(),
		messages: {
			loading: m.chat_update_toast_loading(),
			success: m.chat_update_toast_success(),
			error: m.chat_update_toast_error(),
		},
	});
};

export const usePinChatMutation = () => {
	return useMutationAction({
		mutationOptions: () => orpc.chat.pin.mutationOptions(),
		messages: {
			loading: ({ input }) =>
				input.pinned
					? m.chat_pin_toast_loading()
					: m.chat_unpin_toast_loading(),
			success: ({ input }) =>
				input.pinned
					? m.chat_pin_toast_success()
					: m.chat_unpin_toast_success(),
			error: ({ input }) =>
				input.pinned ? m.chat_pin_toast_error() : m.chat_unpin_toast_error(),
		},
	});
};

const chatDeleteCopy = {
	loading: m.chat_delete_toast_loading,
	success: m.chat_delete_toast_success,
	error: m.chat_delete_toast_error,
	title: m.chat_delete_confirm_title,
	namedTitle: m.chat_delete_confirm_title_named,
	description: m.chat_delete_confirm_description,
	confirmText: m.chat_delete_confirm_button,
};

const conversationDeleteCopy = {
	loading: m.assistant_conversation_delete_toast_loading,
	success: m.assistant_conversation_delete_toast_success,
	error: m.assistant_conversation_delete_toast_error,
	title: m.assistant_conversation_delete_confirm_title,
	namedTitle: m.assistant_conversation_delete_confirm_title_named,
	description: m.assistant_conversation_delete_confirm_description,
	confirmText: m.assistant_conversation_delete_confirm_button,
};

/** Deletes chats, leaving the open one first so it never renders deleted. */
export const useDeleteChatsMutation = (
	target?: DestructiveTarget & {
		/** An Assistant conversation is deleted one at a time and has its own wording. */
		kind?: ChatKind;
	},
) => {
	const params = useParams({
		strict: false,
	});
	const navigate = useNavigate();
	const isConversation = target?.kind === "assistant";

	return useDeleteAction({
		mutationOptions: () =>
			orpc.chat.delete.mutationOptions({
				onMutate: async ({ refs }) => {
					if (params.chatId && refs.some((ref) => ref.id === params.chatId)) {
						await navigate({
							to: isConversation ? "/app/assistant" : "/app/chat",
						});
					}
				},
			}),
		copy: isConversation ? conversationDeleteCopy : chatDeleteCopy,
		target,
	});
};
