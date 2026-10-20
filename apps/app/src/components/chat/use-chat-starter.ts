import type { BotId, ChatId } from "@orcai/core";
import {
	type ChatConfig,
	DEFAULT_FEATURES,
	type Model,
	type Provider,
} from "@orcai/schema";
import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
	type ChatModelAvailability,
	useDefaultChatModel,
} from "@/components/chat/use-default-chat-model";
import { DEFAULT_CHAT_GENERATION_PARAMS } from "@/lib/ai/utils/chat-generation-defaults";
import { reasonMessageOf } from "@/lib/errors/describe-error";
import { client, orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

type ChatAvailability = ChatModelAvailability | "no-quota";

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
	const { data: quotaAvailability } = useQuery(
		orpc.quota.availability.queryOptions({
			input:
				selectedModel && selectedProvider
					? {
							providerId: selectedProvider.id,
							modelId: selectedModel.id,
						}
					: skipToken,
		}),
	);

	const chatAvailability: ChatAvailability =
		availability === "ready" && quotaAvailability?.data.available === false
			? "no-quota"
			: availability;

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
				toast.error(m.chat_composer_model_required_toast_error());
				return;
			}

			if (isCreating) return;
			setIsCreating(true);

			try {
				const config: ChatConfig = {
					modelId: selectedModel.id,
					providerId: selectedProvider.id,
					...DEFAULT_CHAT_GENERATION_PARAMS,
					// Bot chats use the bot's features and reject their own.
					...(selectedBotId
						? {}
						: {
								features: DEFAULT_FEATURES,
							}),
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
				toast.error(m.chat_starter_create_failed_toast_error(), {
					description: reasonMessageOf(error),
				});
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
		availability: chatAvailability,
		isCreating,
		handleModelSelect,
		handleBotSelect: setSelectedBotId,
		handleSend,
	};
};

export { type ChatAvailability, useChatStarter };
