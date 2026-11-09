import { useAssistantModel } from "@/components/assistant/use-assistant-model";
import type { ChatDraft } from "@/components/chat/composer/chat-draft";
import { composerBlocker } from "@/components/chat/composer/composer-blocker";
import { useStartChat } from "@/components/chat/composer/use-start-chat";
import { useQuotaStatus } from "@/components/quota/use-quota-status";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

const useAssistantStarter = () => {
	const { start, isStarting } = useStartChat({
		create: orpc.assistant.create.mutationOptions(),
		errorToast: m.assistant_starter_create_failed_toast_error(),
	});
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

	return {
		availability,
		model: {
			modelId,
			providerId,
		},
		blocker,
		isStarting,
		start: (draft: ChatDraft) => start({}, draft),
	};
};

export { useAssistantStarter };
