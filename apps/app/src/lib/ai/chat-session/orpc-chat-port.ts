import type { ChatKind } from "@orcai/schema";
import {
	eventIteratorToUnproxiedDataStream,
	type InferClientOutputs,
	ORPCError,
} from "@orpc/client";
import { hashKey, type QueryClient } from "@tanstack/react-query";
import { isTextUIPart } from "ai";
import {
	type ChatAgentUIMessage,
	toChatAgentMessages,
} from "@/lib/ai/messages/chat-agent-message";
import { getChatMessageAttachments } from "@/lib/ai/messages/chat-attachment";
import { client, orpc } from "@/lib/orpc/orpc";
import {
	invalidateQuery,
	staleQueriesOfWrites,
} from "@/lib/orpc/stale-queries";
import type { ChatPage, ChatPort } from "./chat-session";

/** A `chatMessage.list` result as a page with its cursor. */
export const chatPageOf = (
	page: InferClientOutputs<typeof client>["chatMessage"]["list"],
): ChatPage => ({
	messages: toChatAgentMessages(page.data),
	before: page.data[0]?.position,
	hasMore: page.hasMore,
});

/** What a finished turn may have changed: the chat list and title, the quota, and what its tools wrote. */
const invalidateAfterTurn = async (
	queryClient: QueryClient,
	kind: ChatKind,
	message: ChatAgentUIMessage,
) => {
	const queryKeys = new Map(
		[
			orpc.chat.key(),
			orpc.quota.status.key(),
			...(kind === "assistant"
				? [
						orpc.assistant.key(),
					]
				: []),
			...staleQueriesOfWrites(orpc, message.metadata?.writes ?? []),
		].map((queryKey) => [
			hashKey(queryKey),
			queryKey,
		]),
	);
	await Promise.all(
		[
			...queryKeys.values(),
		].map((queryKey) => invalidateQuery(queryClient, queryKey)),
	);
};

/** Sent with each turn, so the prompt carries the user's local date. */
const browserTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

export const orpcChatPort = ({
	queryClient,
	kind,
}: {
	queryClient: QueryClient;
	kind: ChatKind;
}): ChatPort => ({
	chat: async ({ message, ...input }, signal) =>
		eventIteratorToUnproxiedDataStream(
			await client.ai.chat(
				{
					...input,
					timeZone: browserTimeZone(),
					message: {
						id: message.id,
						role: "user",
						parts: message.parts.filter(isTextUIPart).map(({ text }) => ({
							type: "text",
							text,
						})),
						attachments: getChatMessageAttachments(message).map(
							({ assetId }) => ({
								assetId,
							}),
						),
					},
				},
				{
					signal,
				},
			),
		),
	continue: async (input, signal) =>
		eventIteratorToUnproxiedDataStream(
			await client.ai.continue(
				{
					...input,
					timeZone: browserTimeZone(),
				},
				{
					signal,
				},
			),
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
	keepUploads: async (input) => (await client.ai.keepUploads(input)).data,
	recordWrites: async (input) => {
		await client.ai.recordTurnWrites(input);
	},
	turnEnded: (message) => invalidateAfterTurn(queryClient, kind, message),
});
