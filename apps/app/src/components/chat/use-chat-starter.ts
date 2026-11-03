import type { BotId, ChatId, ModelId, ProviderId } from "@orcai/core";
import {
	type ChatConfig,
	DEFAULT_FEATURES,
	type Model,
	type Provider,
} from "@orcai/schema";
import {
	type MutationFunctionContext,
	skipToken,
	useMutation,
	useQuery,
} from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { ChatDraft } from "@/components/chat/chat-draft";
import { composerBlocker } from "@/components/chat/composer-blocker";
import { starterModel } from "@/components/chat/model-picker-state";
import { useDefaultChatModel } from "@/components/chat/use-default-chat-model";
import { useQuotaStatus } from "@/components/quota/use-quota-status";
import { callProcedure } from "@/hooks/actions/use-mutation-action";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

const useChatStarter = ({
	initialBotId,
	onChatCreated,
}: {
	initialBotId?: BotId;
	onChatCreated: (
		chatId: ChatId,
		pendingMessage: ChatDraft,
		zedToken?: string,
	) => void | Promise<void>;
}) => {
	// Opening the chat is part of starting it, so its failure toasts too.
	const { mutateAsync: startChat } = useMutation({
		mutationFn: async (
			{
				message,
				...input
			}: {
				botId?: BotId;
				config: ChatConfig;
				message: ChatDraft;
			},
			context: MutationFunctionContext,
		) => {
			const result = await callProcedure(
				orpc.chat.create.mutationOptions(),
				context,
			)(input);
			await onChatCreated(result.data.id, message, result.meta?.zedToken);
		},
		meta: {
			errorToast: m.chat_starter_create_failed_toast_error(),
		},
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
	const [isCreating, setIsCreating] = useState(false);
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

	/** Resolves whether the chat was created, so a failed send keeps its draft. */
	const handleSend = useCallback(
		async (message: ChatDraft): Promise<boolean> => {
			if (!selected) {
				toast.error(m.chat_composer_model_required_toast_error());
				return false;
			}

			if (isCreating) return false;
			setIsCreating(true);

			try {
				const config: ChatConfig = {
					...selected,
					// Bot chats use the bot's features and reject their own.
					...(selectedBotId
						? {}
						: {
								features: DEFAULT_FEATURES,
							}),
				};

				await startChat({
					botId: selectedBotId ?? undefined,
					config,
					message,
				});
				return true;
			} catch {
				setIsCreating(false);
				return false;
			}
		},
		[
			selected,
			selectedBotId,
			isCreating,
			startChat,
		],
	);

	return {
		selectedModelId: selected?.modelId,
		selectedProviderId: selected?.providerId,
		/** The bot's setup in the active organisation, which seeds or fixes the model. */
		setup,
		selectedBotId,
		blocker,
		isCreating,
		handleModelSelect,
		handleBotSelect: setSelectedBotId,
		handleSend,
	};
};

export { useChatStarter };
