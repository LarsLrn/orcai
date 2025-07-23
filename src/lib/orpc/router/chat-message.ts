import { ORPCError } from "@orpc/server";
import { and, asc, count, eq, getTableColumns, inArray } from "drizzle-orm";
import type { ApiGetScoresResponse } from "langfuse";
import { db } from "@/db/drizzle";
import { chat } from "@/db/schema/chat";
import { chatMessage } from "@/db/schema/chat-message";
import { langfuseServer } from "@/lib/langfuse/langfuse-server";
import { authed } from "@/lib/orpc";
import { checkPermissionMiddleware } from "@/lib/orpc/middlewares/permission";
import { retry } from "@/lib/orpc/middlewares/retry";

export const listChatMessages = authed.chatMessage.list
	.use(retry({ times: 3 }))
	.use(
		checkPermissionMiddleware,
		(input) =>
			({
				entityId: input.chatId,
				action: "read",
				entityType: "chat",
			}) as const,
	)
	.handler(async ({ input }) => {
		const query = await db
			.select({ ...getTableColumns(chatMessage) })
			.from(chatMessage)
			.where(eq(chatMessage.chatId, input.chatId))
			.orderBy(asc(chatMessage.createdAt))
			.limit(input.pageSize)
			.offset(input.pageIndex * input.pageSize);

		const [rowCount] = await db
			.select({ count: count() })
			.from(chatMessage)
			.where(eq(chatMessage.chatId, input.chatId));

		let scores: ApiGetScoresResponse = {
			data: [],
			meta: { page: 0, totalItems: 0, limit: 0, totalPages: 0 },
		};

		if (input.includeScores) {
			scores = await langfuseServer.api.scoreV2Get({
				scoreIds: query
					.map((message) => {
						if (message.role !== "user") {
							return message.id;
						}
					})
					.join(","),
			});
		}

		return { data: query, rowCount: rowCount.count, scores };
	});

export const findChatMessage = authed.chatMessage.find
	.use(
		checkPermissionMiddleware,
		(input) =>
			({
				entityId: input.chatId,
				action: "read",
				entityType: "chat",
			}) as const,
	)
	.use(retry({ times: 3 }))
	.handler(async ({ input }) => {
		const [query] = await db
			.select({ ...getTableColumns(chatMessage) })
			.from(chatMessage)
			.where(
				and(eq(chatMessage.id, input.id), eq(chatMessage.chatId, input.chatId)),
			);

		if (!query) {
			throw new ORPCError("NOT_FOUND", { message: "Chat message not found" });
		}

		return { data: query };
	});

export const createChatMessage = authed.chatMessage.create
	.use(
		checkPermissionMiddleware,
		(input) =>
			({
				entityId: input.chatId,
				action: "update",
				entityType: "chat",
			}) as const,
	)
	.handler(async ({ input }) => {
		const [query] = await db
			.insert(chatMessage)
			.values({
				...input,
				createdAt: new Date(),
			})
			.returning({ ...getTableColumns(chatMessage) });

		await db
			.update(chat)
			.set({ updatedAt: new Date() })
			.where(eq(chat.id, input.chatId));

		return { data: query };
	});

export const updateChatMessage = authed.chatMessage.update
	.use(
		checkPermissionMiddleware,
		(input) =>
			({
				entityId: input.chatId,
				action: "update",
				entityType: "chat",
			}) as const,
	)
	.handler(async ({ input }) => {
		const [query] = await db
			.update(chatMessage)
			.set({
				...input,
			})
			.where(
				and(eq(chatMessage.id, input.id), eq(chatMessage.chatId, input.chatId)),
			)
			.returning({ ...getTableColumns(chatMessage) });

		await db
			.update(chat)
			.set({ updatedAt: new Date() })
			.where(eq(chat.id, input.chatId));

		return { data: query };
	});

export const deleteChatMessages = authed.chatMessage.delete
	.use(
		checkPermissionMiddleware,
		(input) =>
			({
				entityId: input.chatId,
				action: "update",
				entityType: "chat",
			}) as const,
	)
	.handler(async ({ input }) => {
		const messageIds = input.refs.map((ref) => ref.id);

		try {
			await db
				.delete(chatMessage)
				.where(
					and(
						inArray(chatMessage.id, messageIds),
						eq(chatMessage.chatId, input.chatId),
					),
				);

			return { success: true, message: "Chat messages deleted successfully" };
		} catch (error) {
			console.error("Error deleting chat messages:", error);
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to delete chat messages",
			});
		}
	});

export const rateChatMessage = authed.chatMessage.rate
	.use(
		checkPermissionMiddleware,
		(input) =>
			({
				entityId: input.chatId,
				action: "update",
				entityType: "chat",
			}) as const,
	)
	.handler(({ input }) => {
		langfuseServer.score({
			id: input.id,
			traceId: input.id,
			name: "rate_helpfulness",
			value: input.sentiment,
			environment: process.env.NODE_ENV,
		});

		return { success: true, message: "Message rated successfully" };
	});
