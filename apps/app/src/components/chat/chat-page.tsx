import type { ChatId, ChatMessageId } from "@orcai/core";
import { type QueryClient, useQuery } from "@tanstack/react-query";
import { useMatch, useRouter, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { useAutoStartTour } from "@/components/tour/tour-provider";
import { orpc } from "@/lib/orpc/orpc";
import { orNotFound } from "@/lib/router/not-found";
import { Chat } from "./chat";
import { chatDraftSchema } from "./chat-draft";

type LoadedChat = Awaited<ReturnType<typeof orpc.chat.find.call>>;

/**
 * Loads a chat page: the chat, which `admit` may reject by throwing, then its
 * newest messages and the bot its settings read.
 */
export const loadChatPage = async (
	{
		queryClient,
		chatId,
		zedToken,
		through,
	}: {
		queryClient: QueryClient;
		chatId: ChatId;
		zedToken?: string;
		/** A message the first page reaches back to. */
		through?: ChatMessageId;
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
		// A bot the settings cannot load fails only there.
		chat.data.botId &&
			queryClient.prefetchQuery(
				orpc.bot.find.queryOptions({
					input: {
						id: chat.data.botId,
					},
				}),
			),
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
	variant,
}: {
	chatId: ChatId;
	zedToken?: string;
	focusMessageId?: ChatMessageId;
	loaded: Awaited<ReturnType<typeof loadChatPage>>;
	variant?: "chat" | "assistant";
}) => {
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

	useAutoStartTour("chatTour", variant !== "assistant");

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
				variant={variant}
			/>
		</div>
	);
};
