import type { ChatId, ChatMessageId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { and, asc, desc, eq, max } from "drizzle-orm";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Result from "effect/Result";
import * as AppErrors from "@/lib/effect/utils/errors";
import { uniqueViolationConstraint } from "@/lib/orpc/implementation/error-mapping";
import { ReplyStore } from "./reply-store";

const CHAT_MESSAGE_PRIMARY_KEY = "chat_message_pkey";

type Transaction = Parameters<
	Parameters<Effect.Success<typeof DB>["transaction"]>[0]
>[0];

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

/** Appends messages in order after the chat's last one. */
export const appendChatMessages = (
	chatId: ChatId,
	messages: Omit<
		typeof dbSchema.chatMessage.$inferInsert,
		"chatId" | "position"
	>[],
) =>
	Effect.gen(function* () {
		const db = yield* DB;

		return yield* db
			.transaction((tx) =>
				lockChat(tx, chatId).pipe(
					Effect.andThen(appendLocked(tx, chatId, messages)),
				),
			)
			.pipe(messageIdTaken);
	});

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
						messages,
					};
				}).pipe(internal("replyStore.load")),
			reserve: ({ chatId, closedReply, question, replyId }) =>
				db
					.transaction((tx) =>
						Effect.gen(function* () {
							yield* lockChat(tx, chatId);
							if (closedReply) {
								yield* tx
									.update(dbSchema.chatMessage)
									.set({
										parts: closedReply.parts,
									})
									.where(messageOf(chatId, closedReply.id));
							}
							yield* appendLocked(tx, chatId, [
								question,
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
								update(reply && last?.id === reply.id ? reply : undefined),
							);
							if (Result.isSuccess(updated)) {
								yield* tx
									.update(dbSchema.chatMessage)
									.set(updated.success)
									.where(messageOf(chatId, replyId));
							}
							return updated;
						}),
					)
					.pipe(
						internal("replyStore.claim"),
						Effect.flatMap(Effect.fromResult),
					),
			settle: ({ chatId, replyId, reply }) =>
				(reply.parts.length === 0
					? db.delete(dbSchema.chatMessage).where(messageOf(chatId, replyId))
					: db
							.update(dbSchema.chatMessage)
							.set(reply)
							.where(messageOf(chatId, replyId))
				).pipe(Effect.asVoid, internal("replyStore.settle")),
		};
	}),
);
