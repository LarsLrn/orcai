import type { ChatId, ChatMessageId } from "@orcai/core";
import {
	mergeReadableParts,
	readableChatMessageParts,
	type StoredChatMessageParts,
} from "@orcai/schema";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as AppErrors from "@/lib/effect/utils/errors";
import {
	type NewMessage,
	ReplyStore,
	type StoredChat,
	type StoredMessage,
} from "./reply-store";

/** A message as its row holds it. */
type Row = Omit<StoredMessage, "parts"> & {
	parts: StoredChatMessageParts;
};

const read = (row: Row): StoredMessage => ({
	...row,
	parts: readableChatMessageParts(row.parts),
});

/** A store holding its chats in memory, for tests. */
export const memoryReplyStore = (chats: StoredChat[]) => {
	const messages = new Map<ChatId, Row[]>(
		chats.map((chat) => [
			chat.id,
			[],
		]),
	);
	const rows = (chatId: ChatId) => messages.get(chatId) ?? [];
	const stored = (chatId: ChatId, message: NewMessage): Row => ({
		...message,
		chatId,
		position: (rows(chatId).at(-1)?.position ?? -1) + 1,
		createdAt: new Date(),
	});
	const replace = (
		chatId: ChatId,
		id: ChatMessageId,
		change: (message: Row) => Row | undefined,
	) => {
		messages.set(
			chatId,
			rows(chatId).flatMap((message) => {
				if (message.id !== id) {
					return [
						message,
					];
				}
				const changed = change(message);
				return changed
					? [
							changed,
						]
					: [];
			}),
		);
	};
	const taken = (id: string) =>
		[
			...messages.values(),
		].some((chatMessages) => chatMessages.some((message) => message.id === id));

	return {
		layer: Layer.succeed(ReplyStore, {
			load: (chatId) =>
				Effect.sync(() => {
					const chat = chats.find((candidate) => candidate.id === chatId);
					return (
						chat && {
							chat,
							messages: rows(chatId).map(read),
						}
					);
				}),
			reserve: ({ chatId, closedReply, question, replyId }) =>
				Effect.suspend(() => {
					if (taken(question.id) || taken(replyId)) {
						return Effect.fail(
							new AppErrors.BadRequestError({
								reason: "CHAT_MESSAGE_ID_TAKEN",
								message: "Chat message id is already taken",
							}),
						);
					}
					if (closedReply) {
						replace(chatId, closedReply.id, (message) => ({
							...message,
							parts: mergeReadableParts(message.parts, closedReply.parts),
						}));
					}
					for (const message of [
						question,
						{
							id: replyId,
							role: "assistant",
							parts: [],
							attachments: [],
							metadata: {},
						},
					]) {
						messages.set(chatId, [
							...rows(chatId),
							stored(chatId, message),
						]);
					}
					return Effect.void;
				}),
			claim: ({ chatId, replyId, update }) =>
				Effect.suspend(() => {
					const last = rows(chatId).at(-1);
					const reply = last?.id === replyId ? last : undefined;
					return update(reply && read(reply)).pipe(
						Effect.map(({ parts, metadata }) => {
							replace(chatId, replyId, (message) => ({
								...message,
								metadata,
								...(parts && {
									parts: mergeReadableParts(message.parts, parts),
								}),
							}));
							return {
								parts: parts ?? readableChatMessageParts(reply?.parts ?? []),
								metadata,
							};
						}),
					);
				}),
			settle: ({ chatId, replyId, reply }) =>
				Effect.sync(() =>
					replace(chatId, replyId, (message) => {
						const parts = mergeReadableParts(message.parts, reply.parts);
						return parts.length === 0
							? undefined
							: {
									...message,
									...reply,
									parts,
								};
					}),
				),
		}),
		/** The chat's messages in order, with the parts this version reads. */
		messages: (chatId: ChatId) => rows(chatId).map(read),
	};
};
