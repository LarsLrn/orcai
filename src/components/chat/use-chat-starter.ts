import { useQueryClient } from "@tanstack/react-query";
import Cookies from "js-cookie";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { client, orpc } from "@/lib/orpc/orpc";
import type { Bot } from "@/lib/orpc/schemas/bot";
import type { ChatConfig } from "@/lib/orpc/schemas/chat";
import type { Model } from "@/lib/orpc/schemas/model";
import type { Provider } from "@/lib/orpc/schemas/provider";
import { COOKIES } from "@/settings/constants";

const useChatStarter = ({
	initialBotId,
	onChatCreated,
}: {
	initialBotId?: Bot["id"];
	onChatCreated: (
		chatId: string,
		pendingMessage: string,
		zedToken?: string,
	) => void | Promise<void>;
}) => {
	const queryClient = useQueryClient();
	const [selectedModel, setSelectedModel] = useState<Model | null>(null);
	const [selectedProvider, setSelectedProvider] = useState<Provider | null>(
		null,
	);
	const [selectedBotId, setSelectedBotId] = useState<Bot["id"] | undefined>(
		initialBotId,
	);
	const [isCreating, setIsCreating] = useState(false);

	useEffect(() => {
		setSelectedBotId(initialBotId);
	}, [
		initialBotId,
	]);

	const handleModelSelect = useCallback((model: Model, provider: Provider) => {
		setSelectedModel(model);
		setSelectedProvider(provider);
	}, []);

	const handleSend = useCallback(
		async (text: string) => {
			if (!selectedModel || !selectedProvider) {
				toast.error("Please select a model before sending a message.");
				return;
			}

			if (isCreating) return;
			setIsCreating(true);

			try {
				const config: ChatConfig = {
					modelId: selectedModel.id,
					providerId: selectedProvider.id,
				};

				const result = await client.chat.create({
					botId: selectedBotId ?? undefined,
					config,
				});

				const chatId = result.data.id;
				const zedToken = result.meta?.zedToken;

				if (zedToken) {
					Cookies.set(COOKIES.ZED_TOKEN.name, zedToken, {
						expires: COOKIES.ZED_TOKEN.expires,
					});
				}

				void queryClient.invalidateQueries({
					queryKey: orpc.chat.key(),
					refetchType: "all",
				});

				await Promise.resolve(onChatCreated(chatId, text, zedToken));
			} catch (error) {
				toast.error("Failed to create chat", {
					description: error instanceof Error ? error.message : "Unknown error",
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
		isCreating,
		handleModelSelect,
		handleBotSelect: setSelectedBotId,
		handleSend,
	};
};

export { useChatStarter };
