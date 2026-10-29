import type { BotId, ModelId, ProviderId } from "@orcai/core";
import type { EffectiveModel } from "@orcai/schema";
import { composerBlocker } from "@/components/chat/composer-blocker";
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

/** The model a chat sends with. */
const chatSelectedModel = (chat: SendStateChat | undefined): SelectedModel => ({
	providerId: chat?.effectiveModel.providerId ?? undefined,
	modelId: chat?.effectiveModel.modelId ?? undefined,
});

/** What blocks sending with a model; the composer and prefilled replies share it. */
const useComposerSendState = ({
	chat,
	selectedModel,
}: {
	chat: SendStateChat | undefined;
	selectedModel: SelectedModel;
}) => {
	const effective = chat?.effectiveModel;
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
		isModelConfigured,
		blocker,
		canSend:
			chat !== undefined &&
			chat.readOnly === null &&
			isModelConfigured &&
			blocker === undefined,
	};
};

export {
	chatSelectedModel,
	type SelectedModel,
	type SendStateChat,
	useComposerSendState,
};
