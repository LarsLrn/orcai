import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import { useUmami } from "@/hooks/use-umami";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

export const useRateChatMessageMutation = () => {
	const { trackEvent } = useUmami();

	return useMutationAction({
		mutationOptions: () =>
			orpc.chatMessage.rate.mutationOptions({
				onSuccess: (_, input) => {
					trackEvent("message-rate", {
						messageId: input.id,
						rating: input.rating,
						chatId: input.chatId,
					});
				},
			}),
		messages: {
			loading: m.chat_message_rate_toast_loading(),
			success: m.chat_message_rate_toast_success(),
			error: m.chat_message_rate_toast_error(),
		},
	});
};
