import { useQueryClient } from "@tanstack/react-query";
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
	const queryClient = useQueryClient();

	return useMutationAction({
		mutationOptions: () =>
			orpc.chat.update.mutationOptions({
				...opts,
				onSuccess: async (...args) => {
					queryClient.invalidateQueries({
						queryKey: orpc.chat.key(),
					});
					queryClient.invalidateQueries({
						queryKey: orpc.assistant.key(),
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
			loading: m.chat_update_toast_loading(),
			success: m.chat_update_toast_success(),
			error: m.chat_update_toast_error(),
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
					queryClient.invalidateQueries({
						queryKey: orpc.assistant.key(),
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
				m.chat_delete_toast_loading({
					count: input.refs.length,
				}),
			success: ({ input }) =>
				m.chat_delete_toast_success({
					count: input.refs.length,
				}),
			error: ({ input }) =>
				m.chat_delete_toast_error({
					count: input.refs.length,
				}),
		},
		confirm: (input) => {
			const count = input.refs.length;
			const name = singleTargetName(count, target);

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
