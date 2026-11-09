import type { BotId, ModelId, ProviderId } from "@orcai/core";
import {
	type BotSetup,
	DEFAULT_FEATURES,
	type Model,
	type Provider,
} from "@orcai/schema";
import { type QueryClient, skipToken, useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import type { ChatDraft } from "@/components/chat/composer/chat-draft";
import { composerBlocker } from "@/components/chat/composer/composer-blocker";
import { starterModel } from "@/components/chat/composer/model-picker-state";
import {
	defaultChatModelQuery,
	useDefaultChatModel,
} from "@/components/chat/composer/use-default-chat-model";
import { useStartChat } from "@/components/chat/composer/use-start-chat";
import {
	quotaStatusQuery,
	useQuotaStatus,
} from "@/components/quota/use-quota-status";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

/** The model a bot's setup recommends, which the default model starts from. */
const recommendedModelId = (setup: BotSetup | null) =>
	setup?.strength === "recommended" ? (setup.model?.id ?? null) : null;

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
			: recommendedModelId(setup),
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

/**
 * Loads what `useChatStarter` and the new chat's composer read for a bot, or
 * for no bot, so the server renders the starter as the browser first does.
 * Resolves with the starting model; a failed read fails only its readers.
 */
const loadChatStarter = async (queryClient: QueryClient, botId?: BotId) => {
	const loadModel = async () => {
		const setup = botId
			? (
					await queryClient.query(
						orpc.botSetup.find.queryOptions({
							input: {
								botId,
							},
						}),
					)
				).data.setup
			: null;
		// A required model needs no default, so a failed default still loads its quota.
		const defaultModel = await queryClient
			.query(defaultChatModelQuery(recommendedModelId(setup)))
			.then(
				({ data }) => data,
				() => null,
			);
		const selected = starterModel({
			setup,
			picked: null,
			defaultModel,
		});
		if (!selected) return undefined;
		await Promise.allSettled([
			queryClient.query(quotaStatusQuery(selected)),
			queryClient.query(
				orpc.model.find.queryOptions({
					input: {
						id: selected.modelId,
					},
				}),
			),
		]);
		return selected;
	};
	const [selected] = await Promise.allSettled([
		loadModel(),
		botId &&
			queryClient.query(
				orpc.bot.find.queryOptions({
					input: {
						id: botId,
					},
				}),
			),
	]);
	return selected.status === "fulfilled" ? selected.value : undefined;
};

export { loadChatStarter, useChatStarter };
