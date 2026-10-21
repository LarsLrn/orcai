import type { ChatId } from "@orcai/core";
import { eventIteratorToUnproxiedDataStream, ORPCError } from "@orpc/client";
import type { QueryClient } from "@tanstack/react-query";
import { toChatAgentMessages } from "@/components/chat/chat-history";
import { staleDataOf } from "@/lib/ai/tools/registry";
import type { ChatAgentUIMessage } from "@/lib/ai/types/chat-agent-message";
import { client, orpc } from "@/lib/orpc/orpc";
import type { ChatPage, ChatPort } from "./chat-session";

/** A `chatMessage.list` result as a page with its cursor. */
export const chatPageOf = (page: {
	data: {
		position: number;
	}[];
	hasMore: boolean;
}): ChatPage => ({
	messages: toChatAgentMessages(page.data),
	before: page.data[0]?.position,
	hasMore: page.hasMore,
});

/** What a finished turn may have changed: the chat list and title, the quota, and data its tools wrote. */
const invalidateAfterTurn = async (
	queryClient: QueryClient,
	{
		chatId,
		variant,
	}: {
		chatId: ChatId;
		variant: "chat" | "assistant";
	},
	message: ChatAgentUIMessage,
) => {
	const namespaces = [
		orpc.chat,
		...(variant === "assistant"
			? [
					orpc.assistant,
				]
			: []),
		...staleDataOf(message).map((namespace) => orpc[namespace]),
	];
	await Promise.all([
		queryClient.invalidateQueries({
			queryKey: orpc.quota.chatBadge.queryKey({
				input: {
					chatId,
				},
			}),
			refetchType: "active",
		}),
		...namespaces.map((namespace) =>
			queryClient.invalidateQueries({
				queryKey: namespace.key(),
				refetchType: "active",
			}),
		),
	]);
};

export const orpcChatPort = ({
	queryClient,
	chatId,
	variant,
}: {
	queryClient: QueryClient;
	chatId: ChatId;
	variant: "chat" | "assistant";
}): ChatPort => ({
	chat: async ({ message, ...input }, signal) =>
		eventIteratorToUnproxiedDataStream(
			await client.ai.chat(
				{
					...input,
					message: {
						...message,
						role: "user",
					},
				},
				{
					signal,
				},
			),
		),
	continue: async (input, signal) =>
		eventIteratorToUnproxiedDataStream(
			await client.ai.continue(input, {
				signal,
			}),
		),
	find: async (input) => {
		try {
			const found = await client.chatMessage.find(input);
			return toChatAgentMessages([
				found.data,
			])[0];
		} catch (error) {
			// Dropped because the turn produced nothing.
			if (error instanceof ORPCError && error.code === "NOT_FOUND") {
				return undefined;
			}
			throw error;
		}
	},
	list: async (input) => chatPageOf(await client.chatMessage.list(input)),
	turnEnded: (message) =>
		invalidateAfterTurn(
			queryClient,
			{
				chatId,
				variant,
			},
			message,
		),
});
