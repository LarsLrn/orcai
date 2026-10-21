import { DB, dbSchema } from "@orcai/db";
import { and, desc, eq, lt } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { appendChatMessages } from "@/lib/ai/turn/drizzle-reply-store";
import { isEmptyReply } from "@/lib/ai/turn/reply-store";
import * as AppErrors from "@/lib/effect/utils/errors";
import { authed } from "@/lib/orpc/implementation/authed";
import { requireEntityPermission } from "@/lib/orpc/middlewares/permission";
import { assistantConversationImmutable } from "./helpers/assistant-conversation";

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

const createChatMessage = authed.chatMessage.create
	.use(
		requireEntityPermission("chat", "edit", {
			entityId: "chatId",
		}),
	)
	.effect(function* ({ input }) {
		const db = yield* DB;
		const chat = yield* db.query.chat.findFirst({
			where: {
				id: {
					eq: input.chatId,
				},
			},
			columns: {
				kind: true,
			},
		});

		if (chat?.kind === "assistant") {
			return yield* Effect.fail(assistantConversationImmutable());
		}

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
