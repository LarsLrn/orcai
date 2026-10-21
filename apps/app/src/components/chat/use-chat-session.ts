import { useChat } from "@ai-sdk/react";
import type { ChatId } from "@orcai/core";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, useSyncExternalStore } from "react";
import { ChatSession, phaseOf } from "@/lib/ai/chat-session/chat-session";
import { chatPageOf, orpcChatPort } from "@/lib/ai/chat-session/orpc-chat-port";

/** The route's chat session: created with the loaded page, stopped when the route leaves. */
export const useChatSession = ({
	chatId,
	page,
	zedToken,
	variant,
}: {
	chatId: ChatId;
	/** The newest page as the loader fetched it. */
	page: Parameters<typeof chatPageOf>[0];
	zedToken: string | undefined;
	variant: "chat" | "assistant";
}) => {
	const queryClient = useQueryClient();
	const [session] = useState(
		() =>
			new ChatSession({
				chatId,
				page: chatPageOf(page),
				zedToken,
				port: orpcChatPort({
					queryClient,
					chatId,
					variant,
				}),
			}),
	);
	useEffect(() => {
		session.sawZedToken(zedToken);
	}, [
		session,
		zedToken,
	]);
	useEffect(
		() => () => {
			void session.stop();
		},
		[
			session,
		],
	);

	const { messages, status, error } = useChat({
		chat: session.chat,
	});
	const storing = useSyncExternalStore(
		session.subscribe,
		() => session.storing,
		() => false,
	);

	return {
		session,
		messages,
		phase: phaseOf(status, storing),
		error,
	};
};
