import { DB, dbSchema } from "@orcai/db";
import { and, desc, eq, inArray, lt, max } from "drizzle-orm";
import * as Effect from "effect/Effect";
import * as AppErrors from "@/lib/effect/utils/errors";
import { authed } from "@/lib/orpc/implementation/authed";
import { uniqueViolationConstraint } from "@/lib/orpc/implementation/error-mapping";
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
			data: rows.slice(0, input.limit).reverse(),
			hasMore: rows.length > input.limit,
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

const CHAT_MESSAGE_PRIMARY_KEY = "chat_message_pkey";

export const createChatMessage = authed.chatMessage.create
	.use(
		requireEntityPermission("chat", "edit", {
			entityId: "chatId",
		}),
	)
	.effect(function* ({ input }) {
		const db = yield* DB;

		// Touching the chat first locks its row, so one insert at a time claims the next position.
		const message = yield* db
			.transaction((tx) =>
				Effect.gen(function* () {
					yield* tx
						.update(dbSchema.chat)
						.set({
							updatedAt: new Date(),
						})
						.where(eq(dbSchema.chat.id, input.chatId));

					const [{ last }] = yield* tx
						.select({
							last: max(dbSchema.chatMessage.position),
						})
						.from(dbSchema.chatMessage)
						.where(eq(dbSchema.chatMessage.chatId, input.chatId));

					const [message] = yield* tx
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

					return message;
				}),
			)
			.pipe(
				Effect.catchIf(
					(error) =>
						uniqueViolationConstraint(error) === CHAT_MESSAGE_PRIMARY_KEY,
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
