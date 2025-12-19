import { useRouter } from "@tanstack/react-router";
import { useFormSubmission } from "@/hooks/form/use-form-submission";
import { orpc } from "@/lib/orpc/orpc";

export const useBotFormSubmission = () => {
	const router = useRouter();

	const create = useFormSubmission({
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

	const update = useFormSubmission({
		mutationOptions: () => orpc.bot.update.mutationOptions(),
		messages: {
			loading: "Updating bot...",
			success: "Bot updated successfully",
			error: "Failed to update bot",
		},
		onSuccess: () => router.history.back(),
	});

	return { create, update };
};
