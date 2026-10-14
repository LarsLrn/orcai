import { useQueryClient } from "@tanstack/react-query";
import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import { useUmami } from "@/hooks/use-umami";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

export const useRateChatMessageMutation = (
	opts: ReturnType<typeof orpc.chatMessage.rate.mutationOptions> = {},
) => {
	const queryClient = useQueryClient();
	const { trackEvent } = useUmami();

	return useMutationAction({
		mutationOptions: () =>
			orpc.chatMessage.rate.mutationOptions({
				...opts,
				onSuccess: async (response, input, ...args) => {
					queryClient.invalidateQueries({
						queryKey: orpc.chatMessage.key({
							input: {
								chatId: input.chatId,
							},
						}),
					});

					trackEvent("message-rate", {
						messageId: input.id,
						sentiment: input.sentiment,
						chatId: input.chatId,
					});

					try {
						await opts.onSuccess?.(response, input, ...args);
					} catch (error) {
						console.error(
							"useRateChatMessageMutation onSuccess callback failed:",
							error,
						);
					}
				},
			}),
		messages: {
			loading: m.chat_message_rate_toast_loading(),
			success: m.chat_message_rate_toast_success(),
			error: m.chat_message_rate_toast_error(),
		},
	});
};
