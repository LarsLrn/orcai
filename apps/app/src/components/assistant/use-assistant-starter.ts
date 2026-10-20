import type { ChatId } from "@orcai/core";
import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import {
	type AssistantModelAvailability,
	useAssistantModel,
} from "@/components/assistant/use-assistant-model";
import { reasonMessageOf } from "@/lib/errors/describe-error";
import { client, orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

type AssistantStarterAvailability = AssistantModelAvailability | "no-quota";

const useAssistantStarter = ({
	onConversationCreated,
}: {
	onConversationCreated: (
		chatId: ChatId,
		pendingMessage: string,
		zedToken?: string,
	) => void | Promise<void>;
}) => {
	const queryClient = useQueryClient();
	const [isCreating, setIsCreating] = useState(false);
	const { availability, modelId, providerId } = useAssistantModel();
	const { data: quotaAvailability } = useQuery(
		orpc.quota.availability.queryOptions({
			input:
				modelId && providerId
					? {
							providerId,
							modelId,
						}
					: skipToken,
		}),
	);

	const starterAvailability: AssistantStarterAvailability =
		availability === "set" && quotaAvailability?.data.available === false
			? "no-quota"
			: availability;

	/** Resolves whether the conversation was created, so a failed send keeps its draft. */
	const handleSend = useCallback(
		async (text: string): Promise<boolean> => {
			if (isCreating) return false;
			setIsCreating(true);

			try {
				const result = await client.assistant.create({});

				void queryClient.invalidateQueries({
					queryKey: orpc.assistant.key(),
					refetchType: "all",
				});

				await Promise.resolve(
					onConversationCreated(result.data.id, text, result.meta?.zedToken),
				);
				return true;
			} catch (error) {
				toast.error(m.assistant_starter_create_failed_toast_error(), {
					description: reasonMessageOf(error),
				});
				setIsCreating(false);
				return false;
			}
		},
		[
			isCreating,
			queryClient,
			onConversationCreated,
		],
	);

	return {
		availability: starterAvailability,
		isCreating,
		handleSend,
	};
};

export { type AssistantStarterAvailability, useAssistantStarter };
