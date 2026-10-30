import type { ChatKind } from "@orcai/schema";
import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import {
	type DestructiveTarget,
	singleTargetName,
} from "@/hooks/mutations/destructive-target";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

export const useUpdateChatMutation = (
	opts: ReturnType<typeof orpc.chat.update.mutationOptions> = {},
) => {
	return useMutationAction({
		mutationOptions: () => orpc.chat.update.mutationOptions(opts),
		messages: {
			loading: m.chat_update_toast_loading(),
			success: m.chat_update_toast_success(),
			error: m.chat_update_toast_error(),
		},
	});
};

export const usePinChatMutation = (
	opts: ReturnType<typeof orpc.chat.pin.mutationOptions> = {},
) => {
	return useMutationAction({
		mutationOptions: () => orpc.chat.pin.mutationOptions(opts),
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

export const useDeleteChatsMutation = (
	opts: ReturnType<typeof orpc.chat.delete.mutationOptions> = {},
	target?: DestructiveTarget & {
		/** An Assistant conversation is deleted one at a time and has its own wording. */
		kind?: ChatKind;
	},
) => {
	const isConversation = target?.kind === "assistant";

	return useMutationAction({
		mutationOptions: () => orpc.chat.delete.mutationOptions(opts),
		messages: {
			loading: ({ input }) =>
				isConversation
					? m.assistant_conversation_delete_toast_loading()
					: m.chat_delete_toast_loading({
							count: input.refs.length,
						}),
			success: ({ input }) =>
				isConversation
					? m.assistant_conversation_delete_toast_success()
					: m.chat_delete_toast_success({
							count: input.refs.length,
						}),
			error: ({ input }) =>
				isConversation
					? m.assistant_conversation_delete_toast_error()
					: m.chat_delete_toast_error({
							count: input.refs.length,
						}),
		},
		confirm: (input) => {
			const count = input.refs.length;
			const name = singleTargetName(count, target);

			if (isConversation)
				return {
					title: name
						? m.assistant_conversation_delete_confirm_title_named({
								name,
							})
						: m.assistant_conversation_delete_confirm_title(),
					description: m.assistant_conversation_delete_confirm_description(),
					confirmText: m.assistant_conversation_delete_confirm_button(),
					cancelText: m.common_cancel_button(),
				};

			return {
				title: name
					? m.chat_delete_confirm_title_named({
							name,
						})
					: m.chat_delete_confirm_title({
							count,
						}),
				description: m.chat_delete_confirm_description({
					count,
				}),
				confirmText: m.chat_delete_confirm_button({
					count,
				}),
				cancelText: m.common_cancel_button(),
			};
		},
	});
};
