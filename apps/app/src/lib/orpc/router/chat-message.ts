import type { ChatId, ChatMessageId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import type { ChatMessageMetadata } from "@orcai/schema";
import type { UIMessage } from "ai";
import { and, desc, eq, lt, max } from "drizzle-orm";
import * as Effect from "effect/Effect";
import * as AppErrors from "@/lib/effect/utils/errors";
import { authed } from "@/lib/orpc/implementation/authed";
import { uniqueViolationConstraint } from "@/lib/orpc/implementation/error-mapping";
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

const CHAT_MESSAGE_PRIMARY_KEY = "chat_message_pkey";

type AppendedChatMessage = Omit<
	typeof dbSchema.chatMessage.$inferInsert,
	"chatId" | "position"
>;

/** Appends messages in order after the chat's last one. */
export const appendChatMessages = (
	chatId: ChatId,
	messages: AppendedChatMessage[],
) =>
	Effect.gen(function* () {
		const db = yield* DB;

		// Touching the chat first locks its row, so one append at a time claims the next positions.
		return yield* db
			.transaction((tx) =>
				Effect.gen(function* () {
					yield* tx
						.update(dbSchema.chat)
						.set({
							updatedAt: new Date(),
						})
						.where(eq(dbSchema.chat.id, chatId));

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
	});

/** A reserved reply that is still empty, e.g. one whose turn never ended. */
export const isEmptyReply = (message: { parts: unknown[] }) =>
	message.parts.length === 0;

/** Fills a reserved reply, or drops it when the turn produced nothing. */
export const settleChatReply = ({
	id,
	chatId,
	parts,
	metadata,
}: {
	id: ChatMessageId;
	chatId: ChatId;
	parts: UIMessage["parts"];
	metadata: ChatMessageMetadata;
}) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const where = and(
			eq(dbSchema.chatMessage.id, id),
			eq(dbSchema.chatMessage.chatId, chatId),
		);

		if (parts.every((part) => part.type === "step-start")) {
			yield* db.delete(dbSchema.chatMessage).where(where);
			return;
		}

		yield* db
			.update(dbSchema.chatMessage)
			.set({
				parts,
				metadata,
			})
			.where(where);
	});

/** Stores a row's parts after its pending tool calls were closed. */
export const storeClosedToolParts = ({
	id,
	chatId,
	parts,
}: {
	id: ChatMessageId;
	chatId: ChatId;
	parts: UIMessage["parts"];
}) =>
	Effect.gen(function* () {
		const db = yield* DB;

		yield* db
			.update(dbSchema.chatMessage)
			.set({
				parts,
			})
			.where(
				and(
					eq(dbSchema.chatMessage.id, id),
					eq(dbSchema.chatMessage.chatId, chatId),
				),
			);
	});

const createChatMessage = authed.chatMessage.create
	.use(
		requireEntityPermission("chat", "edit", {
			entityId: "chatId",
		}),
	)
	.effect(function* ({ input }) {
		const [message] = yield* appendChatMessages(input.chatId, [
			{
				id: input.id,
				role: input.role,
				parts: input.parts,
				attachments: input.attachments ?? [],
				metadata: input.metadata,
			},
		]);

		return {
			data: message,
		};
	});

const rateChatMessage = authed.chatMessage.rate
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

export const chatMessageRouter = {
	list: listChatMessages,
	create: createChatMessage,
	find: findChatMessage,
	rate: rateChatMessage,
};
