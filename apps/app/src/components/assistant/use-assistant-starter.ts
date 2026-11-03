import type { ChatId } from "@orcai/core";
import {
	type MutationFunctionContext,
	useMutation,
} from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { useAssistantModel } from "@/components/assistant/use-assistant-model";
import { composerBlocker } from "@/components/chat/composer-blocker";
import { useQuotaStatus } from "@/components/quota/use-quota-status";
import { callProcedure } from "@/hooks/actions/use-mutation-action";
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
	// Opening the conversation is part of starting it, so its failure toasts too.
	const { mutateAsync: startConversation } = useMutation({
		mutationFn: async (text: string, context: MutationFunctionContext) => {
			const result = await callProcedure(
				orpc.assistant.create.mutationOptions(),
				context,
			)({});
			await onConversationCreated(result.data.id, text, result.meta?.zedToken);
		},
		meta: {
			errorToast: m.assistant_starter_create_failed_toast_error(),
		},
	});
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
				await startConversation(text);
				return true;
			} catch {
				setIsCreating(false);
				return false;
			}
		},
		[
			isCreating,
			startConversation,
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
