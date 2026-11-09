import type { BotId, ModelId, ProviderId } from "@orcai/core";
import type { ChatKind, EffectiveModel } from "@orcai/schema";
import { useAssistantModel } from "@/components/assistant/use-assistant-model";
import { composerBlocker } from "@/components/chat/composer/composer-blocker";
import { useQuotaStatus } from "@/components/quota/use-quota-status";

/** What a chat's sending state reads from the chat. */
type SendStateChat = {
	botId: BotId | null;
	effectiveModel: EffectiveModel;
	/** Null when the requester can continue the chat. */
	readOnly: unknown;
};

/** The model a message is sent with; unset until it is known. */
type SelectedModel = {
	providerId: ProviderId | null | undefined;
	modelId: ModelId | null | undefined;
};

/**
 * The model a chat sends with and what blocks sending with it; the composer
 * and prefilled replies share it. The Assistant's model comes from the
 * organisation.
 */
const useComposerSendState = ({
	chat,
	kind,
}: {
	chat: SendStateChat | undefined;
	kind: ChatKind;
}) => {
	const effective = chat?.effectiveModel;
	const assistantModel = useAssistantModel({
		enabled: kind === "assistant",
	});
	const selectedModel: SelectedModel =
		kind === "assistant"
			? assistantModel
			: {
					providerId: effective?.providerId ?? undefined,
					modelId: effective?.modelId ?? undefined,
				};
	const isModelConfigured = Boolean(
		selectedModel.modelId && selectedModel.providerId,
	);
	// A chat of another organisation has no pool to read.
	const { data: quota } = useQuotaStatus(
		chat?.readOnly === null
			? selectedModel
			: {
					providerId: undefined,
					modelId: undefined,
				},
	);
	// Blocks sending only; a running turn keeps its Stop.
	const blocker = composerBlocker({
		modelAvailable: true,
		quota: quota?.data,
		requiredBy:
			effective?.source === "bot-required" && chat?.botId
				? {
						botId: chat.botId,
						usable: effective.botSetup?.model?.usable === true,
					}
				: undefined,
	});

	return {
		selectedModel,
		isModelConfigured,
		blocker,
		canSend:
			chat !== undefined &&
			chat.readOnly === null &&
			isModelConfigured &&
			blocker === undefined,
	};
};

export { type SelectedModel, useComposerSendState };
