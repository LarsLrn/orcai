import type { ChatId, ChatMessageId } from "@orcai/core";
import { DB, dbSchema, uniqueViolationConstraint } from "@orcai/db";
import {
	type ChatMessagePart,
	chatMessagePartSchema,
	mergeReadableParts,
	readableChatMessageParts,
} from "@orcai/schema";
import { and, asc, desc, eq, max, type SQL } from "drizzle-orm";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Result from "effect/Result";
import * as AppErrors from "@/lib/effect/utils/errors";
import { type ReplyContent, ReplyStore } from "./reply-store";

const CHAT_MESSAGE_PRIMARY_KEY = "chat_message_pkey";

const readMessage = <
	Message extends {
		parts: readonly unknown[];
	},
>(
	message: Message,
) => ({
	...message,
	parts: readableChatMessageParts(message.parts),
});

/** New parts must validate, so every part written reads back. */
const valid = (parts: readonly ChatMessagePart[]) =>
	Effect.try(() => chatMessagePartSchema.array().parse(parts));

type Transaction = Parameters<
	Parameters<Effect.Success<typeof DB>["transaction"]>[0]
>[0];

/** The message's stored parts, held for the rest of the transaction. */
const lockedParts = (tx: Transaction, where: SQL | undefined) =>
	tx
		.select({
			parts: dbSchema.chatMessage.parts,
		})
		.from(dbSchema.chatMessage)
		.where(where)
		.for("update")
		.pipe(Effect.map(([row]) => row?.parts ?? []));

/** Locks the chat's row, so one writer at a time claims its next positions. */
const lockChat = (tx: Transaction, chatId: ChatId) =>
	tx
		.update(dbSchema.chat)
		.set({
			updatedAt: new Date(),
		})
		.where(eq(dbSchema.chat.id, chatId));

const appendLocked = (
	tx: Transaction,
	chatId: ChatId,
	messages: Omit<
		typeof dbSchema.chatMessage.$inferInsert,
		"chatId" | "position"
	>[],
) =>
	Effect.gen(function* () {
		const [{ last }] = yield* tx
			.select({
				last: max(dbSchema.chatMessage.position),
			})
			.from(dbSchema.chatMessage)
			.where(eq(dbSchema.chatMessage.chatId, chatId));

		return yield* tx
			.insert(dbSchema.chatMessage)
			.values(
				messages.map((message, index) => ({
					...message,
					chatId,
					position: (last ?? -1) + 1 + index,
				})),
			)
			.returning();
	});

const messageIdTaken = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
	effect.pipe(
		Effect.catchIf(
			(error) => uniqueViolationConstraint(error) === CHAT_MESSAGE_PRIMARY_KEY,
			(cause) =>
				Effect.fail(
					new AppErrors.BadRequestError({
						reason: "CHAT_MESSAGE_ID_TAKEN",
						message: "Chat message id is already taken",
						cause,
					}),
				),
		),
	);

const internal =
	(operation: string) =>
	<A, E, R>(effect: Effect.Effect<A, E, R>) =>
		effect.pipe(
			Effect.mapError((cause) =>
				cause instanceof AppErrors.BadRequestError
					? cause
					: new AppErrors.InternalError({
							operation,
							cause,
						}),
			),
		);

export const DrizzleReplyStore = Layer.effect(
	ReplyStore,
	Effect.gen(function* () {
		const db = yield* DB;
		const messageOf = (chatId: ChatId, id: ChatMessageId) =>
			and(
				eq(dbSchema.chatMessage.id, id),
				eq(dbSchema.chatMessage.chatId, chatId),
			);

		return {
			load: (chatId) =>
				Effect.gen(function* () {
					const chat = yield* db.query.chat.findFirst({
						where: {
							id: {
								eq: chatId,
							},
						},
					});
					if (!chat) {
						return undefined;
					}
					const messages = yield* db
						.select()
						.from(dbSchema.chatMessage)
						.where(eq(dbSchema.chatMessage.chatId, chatId))
						.orderBy(asc(dbSchema.chatMessage.position));
					return {
						chat,
						messages: messages.map(readMessage),
					};
				}).pipe(internal("replyStore.load")),
			reserve: ({ chatId, closedReply, question, replyId }) =>
				db
					.transaction((tx) =>
						Effect.gen(function* () {
							yield* lockChat(tx, chatId);
							if (closedReply) {
								const where = messageOf(chatId, closedReply.id);
								yield* tx
									.update(dbSchema.chatMessage)
									.set({
										parts: mergeReadableParts(
											yield* lockedParts(tx, where),
											yield* valid(closedReply.parts),
										),
									})
									.where(where);
							}
							yield* appendLocked(tx, chatId, [
								{
									...question,
									parts: yield* valid(question.parts),
								},
								{
									id: replyId,
									role: "assistant",
									parts: [],
									attachments: [],
									metadata: {},
								},
							]);
						}),
					)
					.pipe(messageIdTaken, Effect.asVoid, internal("replyStore.reserve")),
			claim: ({ chatId, replyId, update }) =>
				db
					.transaction((tx) =>
						Effect.gen(function* () {
							yield* tx
								.select({
									id: dbSchema.chat.id,
								})
								.from(dbSchema.chat)
								.where(eq(dbSchema.chat.id, chatId))
								.for("update");

							const [reply] = yield* tx
								.select()
								.from(dbSchema.chatMessage)
								.where(messageOf(chatId, replyId))
								.for("update");

							const [last] = yield* tx
								.select({
									id: dbSchema.chatMessage.id,
								})
								.from(dbSchema.chatMessage)
								.where(eq(dbSchema.chatMessage.chatId, chatId))
								.orderBy(desc(dbSchema.chatMessage.position))
								.limit(1);

							const updated = yield* Effect.result(
								update(
									reply && last?.id === reply.id
										? readMessage(reply)
										: undefined,
								),
							);
							if (Result.isFailure(updated)) {
								return Result.fail(updated.failure);
							}
							const { parts, metadata } = updated.success;
							const written = parts && (yield* valid(parts));
							yield* tx
								.update(dbSchema.chatMessage)
								.set({
									metadata,
									...(written && {
										parts: mergeReadableParts(reply?.parts ?? [], written),
									}),
								})
								.where(messageOf(chatId, replyId));
							return Result.succeed<ReplyContent>({
								parts: written ?? readableChatMessageParts(reply?.parts ?? []),
								metadata,
							});
						}),
					)
					.pipe(
						internal("replyStore.claim"),
						Effect.flatMap(Effect.fromResult),
					),
			settle: ({ chatId, replyId, reply }) =>
				db
					.transaction((tx) =>
						Effect.gen(function* () {
							const where = messageOf(chatId, replyId);
							const parts = mergeReadableParts(
								yield* lockedParts(tx, where),
								yield* valid(reply.parts),
							);
							yield* parts.length === 0
								? tx.delete(dbSchema.chatMessage).where(where)
								: tx
										.update(dbSchema.chatMessage)
										.set({
											...reply,
											parts,
										})
										.where(where);
						}),
					)
					.pipe(Effect.asVoid, internal("replyStore.settle")),
		};
	}),
);
