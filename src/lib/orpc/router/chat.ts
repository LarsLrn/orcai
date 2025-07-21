import { ORPCError } from "@orpc/server";
import { and, count, desc, eq, getTableColumns, inArray } from "drizzle-orm";
import { db } from "@/db/drizzle";
import { chat } from "@/db/schema/chat";
import { authed } from "@/lib/orpc";
import {
	checkManyPermissionMiddleware,
	checkPermissionMiddleware,
} from "@/lib/orpc/middlewares/permission";
import { retry } from "@/lib/orpc/middlewares/retry";
import { createRelation, listAllowedEntities } from "@/lib/spice-db/actions";

export const listChats = authed.chat.list
	.use(retry({ times: 3 }))
	.handler(async ({ input, context }) => {
		const { entityIds } = await listAllowedEntities({
			userId: context.auth.user.id,
			action: "read",
			entityType: "chat",
		});

		const query = await db
			.select({ ...getTableColumns(chat) })
			.from(chat)
			.where(and(inArray(chat.id, entityIds)))
			.orderBy(desc(chat.createdAt))
			.limit(input.pageSize)
			.offset(input.pageIndex * input.pageSize);

		const [rowCount] = await db
			.select({ count: count() })
			.from(chat)
			.where(inArray(chat.id, entityIds));

		return { data: query, rowCount: rowCount.count };
	});

export const findChat = authed.chat.find
	.use(
		checkPermissionMiddleware,
		(input) =>
			({
				entityId: input.id,
				action: "read",
				entityType: "chat",
			}) as const,
	)
	.use(retry({ times: 3 }))
	.handler(async ({ input }) => {
		const [query] = await db
			.select({ ...getTableColumns(chat) })
			.from(chat)
			.where(eq(chat.id, input.id));

		if (!query) {
			throw new ORPCError("NOT_FOUND", { message: "Chat not found" });
		}

		return { data: query };
	});

// TODO: Add permission check for botId
export const createChat = authed.chat.create.handler(
	async ({ input, context }) => {
		const [query] = await db
			.insert(chat)
			.values({
				title: input.title ?? "New Chat",
				userId: context.auth.user.id,
				botId: input.botId,
			})
			.returning({ ...getTableColumns(chat) });

		await createRelation({
			entityId: query.id,
			entityType: "chat",
			userId: context.auth.user.id,
			relation: "owner",
		});

		return { data: query };
	},
);

export const updateChat = authed.chat.update
	.use(
		checkPermissionMiddleware,
		(input) =>
			({
				entityId: input.id,
				action: "read",
				entityType: "chat",
			}) as const,
	)
	.handler(async ({ input }) => {
		const [query] = await db
			.update(chat)
			.set({
				title: input.title,
				updatedAt: new Date(),
			})
			.where(eq(chat.id, input.id))
			.returning({ ...getTableColumns(chat) });

		return { data: query };
	});

export const deleteChats = authed.chat.delete
	.use(
		checkManyPermissionMiddleware,
		(input) =>
			({
				entityIds: input.refs.map((ref) => ref.id),
				action: "delete",
				entityType: "chat",
			}) as const,
	)
	.handler(async ({ context }) => {
		console.log("Deleting chats with allowed IDs:", context.allowedIds);

		// Check if there are any IDs to delete
		if (!context.allowedIds || context.allowedIds.length === 0) {
			return { success: true, message: "No chats to delete" };
		}

		try {
			await db.delete(chat).where(inArray(chat.id, context.allowedIds));

			return { success: true, message: "Chats deleted successfully" };
		} catch (error) {
			console.error("Error deleting chats:", error);
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to delete chats",
			});
		}
	});
