import type { BotId, ModelId, ProviderId } from "@orcai/core";
import { DEFAULT_FEATURES, type Model, type Provider } from "@orcai/schema";
import { skipToken, useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import type { ChatDraft } from "@/components/chat/chat-draft";
import { composerBlocker } from "@/components/chat/composer-blocker";
import { starterModel } from "@/components/chat/model-picker-state";
import { useDefaultChatModel } from "@/components/chat/use-default-chat-model";
import { useStartChat } from "@/components/chat/use-start-chat";
import { useQuotaStatus } from "@/components/quota/use-quota-status";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

const useChatStarter = ({ initialBotId }: { initialBotId?: BotId } = {}) => {
	const { start, isStarting } = useStartChat({
		create: orpc.chat.create.mutationOptions(),
		errorToast: m.chat_starter_create_failed_toast_error(),
	});
	// A pick belongs to the bot it was made for, so another bot brings its own recommendation.
	const [pick, setPick] = useState<{
		botId: BotId | undefined;
		modelId: ModelId;
		providerId: ProviderId;
	} | null>(null);
	const [selectedBotId, setSelectedBotId] = useState<BotId | undefined>(
		initialBotId,
	);
	const { data: setupData, status: setupStatus } = useQuery(
		orpc.botSetup.find.queryOptions({
			input: selectedBotId
				? {
						botId: selectedBotId,
					}
				: skipToken,
		}),
	);
	const setup = selectedBotId ? (setupData?.data.setup ?? null) : null;
	const { none, defaultModel } = useDefaultChatModel(
		selectedBotId && setupStatus === "pending"
			? undefined
			: setup?.strength === "recommended"
				? (setup.model?.id ?? null)
				: null,
	);
	const picked =
		pick && pick.botId === selectedBotId
			? {
					modelId: pick.modelId,
					providerId: pick.providerId,
				}
			: null;
	const required = setup?.strength === "required" ? setup : null;
	const selected = starterModel({
		setup,
		picked,
		defaultModel,
	});
	const { data: quota } = useQuotaStatus({
		providerId: selected?.providerId,
		modelId: selected?.modelId,
	});

	const blocker = composerBlocker({
		modelAvailable: !none || !!selected,
		quota: quota?.data,
		requiredBy:
			required && selectedBotId
				? {
						botId: selectedBotId,
						usable: required.model?.usable === true,
					}
				: undefined,
	});

	useEffect(() => {
		setSelectedBotId(initialBotId);
	}, [
		initialBotId,
	]);

	const handleModelSelect = useCallback(
		(model: Model, provider: Provider) => {
			setPick({
				botId: selectedBotId,
				modelId: model.id,
				providerId: provider.id,
			});
		},
		[
			selectedBotId,
		],
	);

	const handleSend = (draft: ChatDraft) =>
		selected
			? start(
					{
						botId: selectedBotId,
						config: {
							...selected,
							// Bot chats use the bot's features and reject their own.
							...(selectedBotId
								? {}
								: {
										features: DEFAULT_FEATURES,
									}),
						},
					},
					draft,
				)
			: Promise.resolve(false);

	return {
		selectedModelId: selected?.modelId,
		selectedProviderId: selected?.providerId,
		/** The bot's setup in the active organisation, which seeds or fixes the model. */
		setup,
		selectedBotId,
		blocker,
		isStarting,
		handleModelSelect,
		handleBotSelect: setSelectedBotId,
		handleSend,
	};
};

export { useChatStarter };
