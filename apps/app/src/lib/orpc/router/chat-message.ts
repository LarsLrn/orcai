import { DB, dbSchema } from "@orcai/db";
import { and, asc, count, eq, inArray, max } from "drizzle-orm";
import * as Effect from "effect/Effect";
import * as AppErrors from "@/lib/effect/utils/errors";
import { authed } from "@/lib/orpc/implementation/authed";
import { requireEntityPermission } from "@/lib/orpc/middlewares/permission";

export const listChatMessages = authed.chatMessage.list
	.use(
		requireEntityPermission("chat", "read", {
			entityId: "chatId",
			zedToken: "zedToken",
		}),
	)
	.effect(function* ({ input }) {
		const db = yield* DB;

		const chatMessages = yield* db
			.select()
			.from(dbSchema.chatMessage)
			.where(eq(dbSchema.chatMessage.chatId, input.chatId))
			.orderBy(asc(dbSchema.chatMessage.position))
			.limit(input.pageSize)
			.offset(input.pageIndex * input.pageSize);

		const [rowCount] = yield* db
			.select({
				count: count(),
			})
			.from(dbSchema.chatMessage)
			.where(eq(dbSchema.chatMessage.chatId, input.chatId));

		return {
			data: chatMessages,
			rowCount: rowCount.count,
			scores: {
				data: [],
				meta: {
					page: 1,
					totalItems: 0,
					limit: 0,
					totalPages: 0,
				},
			}, // Placeholder for scores, to be implemented when rating is added
		};
	});

export const findChatMessage = authed.chatMessage.find
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

export const createChatMessage = authed.chatMessage.create
	.use(
		requireEntityPermission("chat", "edit", {
			entityId: "chatId",
		}),
	)
	.effect(function* ({ input }) {
		const db = yield* DB;

		const [{ last }] = yield* db
			.select({
				last: max(dbSchema.chatMessage.position),
			})
			.from(dbSchema.chatMessage)
			.where(eq(dbSchema.chatMessage.chatId, input.chatId));

		const [message] = yield* db
			.insert(dbSchema.chatMessage)
			.values({
				id: input.id,
				chatId: input.chatId,
				role: input.role,
				parts: input.parts,
				attachments: input.attachments ?? [],
				metadata: input.metadata,
				position: (last ?? -1) + 1,
			})
			.returning();

		yield* db
			.update(dbSchema.chat)
			.set({
				updatedAt: new Date(),
			})
			.where(eq(dbSchema.chat.id, input.chatId));

		return {
			data: message,
		};
	});

export const deleteChatMessages = authed.chatMessage.delete
	.use(
		requireEntityPermission("chat", "edit", {
			entityId: "chatId",
		}),
	)
	.effect(function* ({ input }) {
		const db = yield* DB;

		const messageIds = input.refs.map((ref) => ref.id);

		yield* db
			.delete(dbSchema.chatMessage)
			.where(
				and(
					inArray(dbSchema.chatMessage.id, messageIds),
					eq(dbSchema.chatMessage.chatId, input.chatId),
				),
			);

		return {
			success: true,
			message: "Chat messages deleted successfully",
		};
	});

export const rateChatMessage = authed.chatMessage.rate
	.use(
		requireEntityPermission("chat", "edit", {
			entityId: "chatId",
		}),
	)
	.effect(function* ({ input }) {
		return yield* Effect.try({
			try: () =>
				// TODO: Implement actual rating logic, currently just a placeholder
				Effect.succeed({
					success: true,
					message: "Message rated successfully",
					data: input,
				}),
			catch: () =>
				new AppErrors.BadRequestError({
					reason: "CHAT_RATING_FAILED",
					message: "Error rating message",
				}),
		}).pipe(
			Effect.map(() => ({
				success: true,
				message: "Message rated successfully",
				data: input,
			})),
		);
	});
