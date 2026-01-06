import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useUmami } from "@/hooks/use-umami";
import { orpc } from "@/lib/orpc/orpc";
import type { Bot } from "@/lib/orpc/schemas/bot";

export const useCreateChat = () => {
	const navigate = useNavigate();
	const { trackEvent } = useUmami();

	const { mutateAsync, ...mutation } = useMutation(
		orpc.chat.create.mutationOptions(),
	);

	const createChat = (botId?: Bot["id"]) => {
		return toast.promise(mutateAsync({ botId }), {
			loading: "Creating new chat...",
			success: async (result) => {
				await navigate({
					to: "/app/chat/$chatId",
					params: { chatId: result.data.id },
				});
				trackEvent("chat-create", { chatId: result.data.id });
				return "New chat created";
			},
			error: (error) => ({
				message: "Failed to create chat",
				description: error.message,
			}),
		});
	};

	return { createChat, ...mutation };
};
