import { useRouter } from "@tanstack/react-router";
import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import { orpc } from "@/lib/orpc/orpc";

export const useBotMutations = () => {
	const router = useRouter();

	const createBot = useMutationAction({
		mutationOptions: () => orpc.bot.create.mutationOptions(),
		messages: {
			loading: "Creating bot...",
			success: "Bot created successfully",
			error: "Failed to create bot",
		},
		onSuccess: (result) =>
			router.navigate({
				to: "/app/bots/$botId",
				params: { botId: result.data.id },
			}),
	});

	const updateBot = useMutationAction({
		mutationOptions: () => orpc.bot.update.mutationOptions(),
		messages: {
			loading: "Updating bot...",
			success: "Bot updated successfully",
			error: "Failed to update bot",
		},
		onSuccess: () => router.history.back(),
	});

	return { createBot, updateBot };
};
