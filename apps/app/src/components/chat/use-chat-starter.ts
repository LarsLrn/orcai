import type { BotId, ChatId } from "@orcai/core";
import {
	type ChatConfig,
	DEFAULT_FEATURES,
	type Model,
	type Provider,
} from "@orcai/schema";
import { useMutation } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
	type ChatModelAvailability,
	useDefaultChatModel,
} from "@/components/chat/use-default-chat-model";
import { useQuotaStatus } from "@/components/quota/use-quota-status";
import { reasonMessageOf } from "@/lib/errors/describe-error";
import { orpc } from "@/lib/orpc/orpc";
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
	const { mutateAsync: createChat } = useMutation(
		orpc.chat.create.mutationOptions(),
	);
	const [selectedModel, setSelectedModel] = useState<Model | null>(null);
	const [selectedProvider, setSelectedProvider] = useState<Provider | null>(
		null,
	);
	const [selectedBotId, setSelectedBotId] = useState<BotId | undefined>(
		initialBotId,
	);
	const [isCreating, setIsCreating] = useState(false);
	const { availability, defaultModel, defaultProvider } = useDefaultChatModel();
	const { data: quota } = useQuotaStatus({
		providerId: selectedProvider?.id,
		modelId: selectedModel?.id,
	});

	const chatAvailability: ChatAvailability =
		availability === "ready" && quota?.data.available === false
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
					// Bot chats use the bot's features and reject their own.
					...(selectedBotId
						? {}
						: {
								features: DEFAULT_FEATURES,
							}),
				};

				const result = await createChat({
					botId: selectedBotId ?? undefined,
					config,
				});

				await Promise.resolve(
					onChatCreated(result.data.id, text, result.meta?.zedToken),
				);
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
			createChat,
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
