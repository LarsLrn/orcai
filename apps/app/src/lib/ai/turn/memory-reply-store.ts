import type { ChatId, ChatMessageId } from "@orcai/core";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as AppErrors from "@/lib/effect/utils/errors";
import {
	type NewMessage,
	ReplyStore,
	type StoredChat,
	type StoredMessage,
} from "./reply-store";

/** A store holding its chats in memory, for tests. */
export const memoryReplyStore = (chats: StoredChat[]) => {
	const messages = new Map<ChatId, StoredMessage[]>(
		chats.map((chat) => [
			chat.id,
			[],
		]),
	);
	const rows = (chatId: ChatId) => messages.get(chatId) ?? [];
	const stored = (chatId: ChatId, message: NewMessage): StoredMessage => ({
		...message,
		chatId,
		position: (rows(chatId).at(-1)?.position ?? -1) + 1,
		createdAt: new Date(),
	});
	const replace = (
		chatId: ChatId,
		id: ChatMessageId,
		change: (message: StoredMessage) => StoredMessage | undefined,
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
							messages: rows(chatId),
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
							parts: closedReply.parts,
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
					return update(last?.id === replyId ? last : undefined);
				}).pipe(
					Effect.tap((content) =>
						Effect.sync(() =>
							replace(chatId, replyId, (message) => ({
								...message,
								...content,
							})),
						),
					),
				),
			settle: ({ chatId, replyId, reply }) =>
				Effect.sync(() =>
					replace(chatId, replyId, (message) =>
						reply.parts.length === 0
							? undefined
							: {
									...message,
									...reply,
								},
					),
				),
		}),
		/** The chat's messages in order. */
		messages: rows,
	};
};
