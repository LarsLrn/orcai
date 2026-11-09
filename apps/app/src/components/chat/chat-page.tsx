import type { ChatId, ChatMessageId, OrganizationId } from "@orcai/core";
import { type QueryClient, useQuery } from "@tanstack/react-query";
import { useMatch, useRouter, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { loadAssistantModel } from "@/components/assistant/use-assistant-model";
import { loadWebSearchNotice } from "@/components/chat/web-search-notice";
import { loadChatRepositoryReadiness } from "@/components/preparation/use-repository-readiness";
import { quotaStatusQuery } from "@/components/quota/use-quota-status";
import { useAutoStartTour } from "@/components/tour/tour-provider";
import { orpc } from "@/lib/orpc/orpc";
import { orNotFound } from "@/lib/router/not-found";
import { Chat } from "./chat";
import { chatDraftSchema } from "./composer/chat-draft";

type LoadedChat = Awaited<ReturnType<typeof orpc.chat.find.call>>;

/** Loads what the composer and notices of a chat the user can continue read about its model. */
const loadComposer = async (
	queryClient: QueryClient,
	chat: LoadedChat["data"],
	organizationId: OrganizationId,
) => {
	if (chat.kind === "assistant") {
		await loadAssistantModel(queryClient, organizationId, {
			quota: true,
		});
		return;
	}
	const { providerId, modelId } = chat.effectiveModel;
	await Promise.allSettled([
		modelId &&
			queryClient.query(
				orpc.model.find.queryOptions({
					input: {
						id: modelId,
					},
				}),
			),
		providerId &&
			modelId &&
			queryClient.query(
				quotaStatusQuery({
					providerId,
					modelId,
				}),
			),
		loadWebSearchNotice(queryClient, {
			organizationId,
			botId: chat.botId,
			providerId,
		}),
	]);
};

/**
 * Loads a chat page: the chat, which `admit` may reject by throwing, then its
 * newest messages and what the page around them reads. Only the chat and its
 * messages fail the page.
 */
export const loadChatPage = async (
	{
		queryClient,
		chatId,
		zedToken,
		through,
		organizationId,
	}: {
		queryClient: QueryClient;
		chatId: ChatId;
		zedToken?: string;
		/** A message the first page reaches back to. */
		through?: ChatMessageId;
		/** The active organisation, whose models a chat the user can continue sends with. */
		organizationId?: OrganizationId;
	},
	admit: (chat: LoadedChat["data"]) => void,
) => {
	const chat = await orNotFound(
		queryClient.query(
			orpc.chat.find.queryOptions({
				input: {
					id: chatId,
					zedToken,
				},
				staleTime: 0,
			}),
		),
	);

	admit(chat.data);

	const [messages] = await Promise.all([
		queryClient.query(
			orpc.chatMessage.list.queryOptions({
				input: {
					chatId,
					zedToken,
					through,
				},
				staleTime: 0,
			}),
		),
		Promise.allSettled([
			chat.data.botId &&
				queryClient.query(
					orpc.bot.find.queryOptions({
						input: {
							id: chat.data.botId,
						},
					}),
				),
			chat.data.botId &&
				queryClient.query(
					orpc.botSetup.find.queryOptions({
						input: {
							botId: chat.data.botId,
						},
					}),
				),
			queryClient.query(
				orpc.chatMessage.listRatings.queryOptions({
					input: {
						chatId,
					},
				}),
			),
			loadChatRepositoryReadiness(queryClient, {
				chatId,
				botId: chat.data.botId,
			}),
			chat.data.readOnly === null &&
				organizationId &&
				loadComposer(queryClient, chat.data, organizationId),
		]),
	]);

	return {
		chat,
		messages,
	};
};

/** A chat route's page: the chat with what the navigation handed it, its title kept in step with the route's head. */
export const ChatPage = ({
	chatId,
	zedToken,
	focusMessageId,
	loaded,
}: {
	chatId: ChatId;
	zedToken?: string;
	focusMessageId?: ChatMessageId;
	loaded: Awaited<ReturnType<typeof loadChatPage>>;
}) => {
	const { kind } = loaded.chat.data;
	const router = useRouter();
	const matchId = useMatch({
		strict: false,
		select: (match) => match.id,
	});
	const { data: chat } = useQuery(
		orpc.chat.find.queryOptions({
			input: {
				id: chatId,
				zedToken,
			},
		}),
	);
	const title = chat?.data.title;
	const loadedTitle = loaded.chat.data.title;

	// The breadcrumb and document title come from `head`, which only reruns with the loader.
	useEffect(() => {
		if (title === undefined || title === loadedTitle) return;
		void router.invalidate({
			filter: (match) => match.id === matchId,
		});
	}, [
		title,
		loadedTitle,
		router,
		matchId,
	]);

	useAutoStartTour("chatTour", kind === "chat");

	const pendingState = useRouterState({
		select: (state) => state.location.state.pendingMessage,
	});
	const pendingMessage = useMemo(
		() => chatDraftSchema.safeParse(pendingState).data,
		[
			pendingState,
		],
	);
	const draftState = useRouterState({
		select: (state) => state.location.state.draft,
	});
	const draft = chatDraftSchema.safeParse(draftState).data;

	return (
		// The shell above the outlet takes the 48px header plus its 24px of vertical padding.
		<div className="flex h-[calc(100dvh-6rem)] min-h-0 flex-col">
			{/* A search hit loads the page reaching back to it, so each opens its own session. */}
			<Chat
				key={`${chatId}:${focusMessageId ?? ""}`}
				id={chatId}
				page={loaded.messages}
				zedToken={zedToken}
				focusMessageId={focusMessageId}
				pendingMessage={pendingMessage}
				draft={draft}
				kind={kind}
			/>
		</div>
	);
};
