import type { BotId, ChatId } from "@orcai/core";
import type { ChatConfig, Model, Provider } from "@orcai/schema";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useDefaultChatModel } from "@/components/chat/use-default-chat-model";
import { DEFAULT_CHAT_GENERATION_PARAMS } from "@/lib/ai/utils/chat-generation-defaults";
import { client, orpc } from "@/lib/orpc/orpc";

const useChatStarter = ({
	initialBotId,
	onChatCreated,
}: {
	initialBotId?: BotId;
	onChatCreated: (
		chatId: ChatId,
		pendingMessage: string,
		zedToken?: string,
	) => void | Promise<void>;
}) => {
	const queryClient = useQueryClient();
	const [selectedModel, setSelectedModel] = useState<Model | null>(null);
	const [selectedProvider, setSelectedProvider] = useState<Provider | null>(
		null,
	);
	const [selectedBotId, setSelectedBotId] = useState<BotId | undefined>(
		initialBotId,
	);
	const [isCreating, setIsCreating] = useState(false);
	const { availability, defaultModel, defaultProvider } = useDefaultChatModel();

	useEffect(() => {
		setSelectedBotId(initialBotId);
	}, [
		initialBotId,
	]);

	useEffect(() => {
		if (selectedModel || !defaultModel || !defaultProvider) return;
		setSelectedModel(defaultModel);
		setSelectedProvider(defaultProvider);
	}, [
		selectedModel,
		defaultModel,
		defaultProvider,
	]);

	const handleModelSelect = useCallback((model: Model, provider: Provider) => {
		setSelectedModel(model);
		setSelectedProvider(provider);
	}, []);

	const handleSend = useCallback(
		async (text: string) => {
			if (!selectedModel || !selectedProvider) {
				toast.error("Choose a model before sending a message.");
				return;
			}

			if (isCreating) return;
			setIsCreating(true);

			try {
				const config: ChatConfig = {
					modelId: selectedModel.id,
					providerId: selectedProvider.id,
					...DEFAULT_CHAT_GENERATION_PARAMS,
				};

				const result = await client.chat.create({
					botId: selectedBotId ?? undefined,
					config,
				});

				const chatId = result.data.id;
				const zedToken = result.meta?.zedToken;

				void queryClient.invalidateQueries({
					queryKey: orpc.chat.key(),
					refetchType: "all",
				});

				await Promise.resolve(onChatCreated(chatId, text, zedToken));
			} catch (error) {
				toast.error(
					"The chat was not created. Try sending the message again.",
					{
						description: error instanceof Error ? error.message : undefined,
					},
				);
				setIsCreating(false);
			}
		},
		[
			selectedModel,
			selectedProvider,
			selectedBotId,
			isCreating,
			queryClient,
			onChatCreated,
		],
	);

	return {
		selectedModelId: selectedModel?.id,
		selectedProviderId: selectedProvider?.id,
		selectedBotId,
		modelAvailability: availability,
		isCreating,
		handleModelSelect,
		handleBotSelect: setSelectedBotId,
		handleSend,
	};
};

export { useChatStarter };
