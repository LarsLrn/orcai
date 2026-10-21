import { DB, dbSchema } from "@orcai/db";
import { and, desc, eq, lt } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { isEmptyReply } from "@/lib/ai/turn/reply-store";
import * as AppErrors from "@/lib/effect/utils/errors";
import { authed } from "@/lib/orpc/implementation/authed";
import { requireEntityPermission } from "@/lib/orpc/middlewares/permission";

const listChatMessages = authed.chatMessage.list
	.use(
		requireEntityPermission("chat", "read", {
			entityId: "chatId",
			zedToken: "zedToken",
		}),
	)
	.effect(function* ({ input }) {
		const db = yield* DB;

		const rows = yield* db
			.select()
			.from(dbSchema.chatMessage)
			.where(
				and(
					eq(dbSchema.chatMessage.chatId, input.chatId),
					input.before === undefined
						? undefined
						: lt(dbSchema.chatMessage.position, input.before),
				),
			)
			.orderBy(desc(dbSchema.chatMessage.position))
			.limit(input.limit + 1);

		return {
			data: rows
				.slice(0, input.limit)
				.reverse()
				.filter((message) => !isEmptyReply(message)),
			hasMore: rows.length > input.limit,
		};
	});

const findChatMessage = authed.chatMessage.find
	.use(
		requireEntityPermission("chat", "read", {
			entityId: "chatId",
			zedToken: "zedToken",
		}),
	)
	.effect(function* ({ input }) {
		const db = yield* DB;

		return yield* db.query.chatMessage
			.findFirst({
				where: {
					AND: [
						{
							id: {
								eq: input.id,
							},
						},
						{
							chatId: {
								eq: input.chatId,
							},
						},
					],
				},
			})
			.pipe(
				Effect.flatMap((chat) =>
					Effect.fromNullishOr(chat).pipe(
						Effect.mapError(
							() =>
								new AppErrors.NotFoundError({
									reason: "CHAT_MESSAGE_NOT_FOUND",
									id: input.id,
									message: "Chat message not found",
								}),
						),
					),
				),
				Effect.map((chat) => ({
					data: chat,
				})),
			);
	});

const listChatMessageRatings = authed.chatMessage.listRatings
	.use(
		requireEntityPermission("chat", "read", {
			entityId: "chatId",
			zedToken: "zedToken",
		}),
	)
	.effect(function* ({ input, context }) {
		const db = yield* DB;

		const data = yield* db
			.select({
				messageId: dbSchema.chatMessageRating.messageId,
				rating: dbSchema.chatMessageRating.rating,
			})
			.from(dbSchema.chatMessageRating)
			.innerJoin(
				dbSchema.chatMessage,
				eq(dbSchema.chatMessage.id, dbSchema.chatMessageRating.messageId),
			)
			.where(
				and(
					eq(dbSchema.chatMessage.chatId, input.chatId),
					eq(dbSchema.chatMessageRating.userId, context.auth.user.id),
				),
			);

		return {
			data,
		};
	});

const rateChatMessage = authed.chatMessage.rate
	.use(
		requireEntityPermission("chat", "read", {
			entityId: "chatId",
		}),
	)
	.effect(function* ({ input, context }) {
		const db = yield* DB;
		const userId = context.auth.user.id;

		const [message] = yield* db
			.select({
				id: dbSchema.chatMessage.id,
			})
			.from(dbSchema.chatMessage)
			.where(
				and(
					eq(dbSchema.chatMessage.id, input.id),
					eq(dbSchema.chatMessage.chatId, input.chatId),
				),
			);

		if (!message) {
			return yield* Effect.fail(
				new AppErrors.NotFoundError({
					reason: "CHAT_MESSAGE_NOT_FOUND",
					id: input.id,
					message: "Chat message not found",
				}),
			);
		}

		if (input.rating === null) {
			yield* db
				.delete(dbSchema.chatMessageRating)
				.where(
					and(
						eq(dbSchema.chatMessageRating.messageId, input.id),
						eq(dbSchema.chatMessageRating.userId, userId),
					),
				);
		} else {
			yield* db
				.insert(dbSchema.chatMessageRating)
				.values({
					messageId: input.id,
					userId,
					rating: input.rating,
				})
				.onConflictDoUpdate({
					target: [
						dbSchema.chatMessageRating.messageId,
						dbSchema.chatMessageRating.userId,
					],
					set: {
						rating: input.rating,
						updatedAt: new Date(),
					},
				});
		}

		return {
			data: {
				messageId: input.id,
				rating: input.rating,
			},
		};
	});

export const chatMessageRouter = {
	list: listChatMessages,
	find: findChatMessage,
	listRatings: listChatMessageRatings,
	rate: rateChatMessage,
};
