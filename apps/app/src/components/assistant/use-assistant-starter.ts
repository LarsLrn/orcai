import type { ChatId } from "@orcai/core";
import { useMutation } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useAssistantModel } from "@/components/assistant/use-assistant-model";
import { composerBlocker } from "@/components/chat/composer-blocker";
import { useQuotaStatus } from "@/components/quota/use-quota-status";
import { reasonMessageOf } from "@/lib/errors/describe-error";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

const useAssistantStarter = ({
	onConversationCreated,
}: {
	onConversationCreated: (
		chatId: ChatId,
		pendingMessage: string,
		zedToken?: string,
	) => void | Promise<void>;
}) => {
	const { mutateAsync: createConversation } = useMutation(
		orpc.assistant.create.mutationOptions(),
	);
	const [isCreating, setIsCreating] = useState(false);
	const { availability, modelId, providerId } = useAssistantModel();
	const { data: quota } = useQuotaStatus({
		providerId,
		modelId,
	});

	const blocker =
		availability === "set"
			? composerBlocker({
					modelAvailable: true,
					quota: quota?.data,
				})
			: undefined;

	/** Resolves whether the conversation was created, so a failed send keeps its draft. */
	const handleSend = useCallback(
		async (text: string): Promise<boolean> => {
			if (isCreating) return false;
			setIsCreating(true);

			try {
				const result = await createConversation({});

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
			createConversation,
			onConversationCreated,
		],
	);

	return {
		availability,
		blocker,
		isCreating,
		handleSend,
	};
};

export { useAssistantStarter };
