import { getLogger } from "@orpc/experimental-pino";
import { ORPCError } from "@orpc/server";
import { count, desc, eq, getTableColumns, inArray } from "drizzle-orm";
import { db } from "@/db/drizzle";
import { chat } from "@/db/schema/chat";
import { chatBranch } from "@/db/schema/chat-branch";
import { authed } from "@/lib/orpc/implementation/authed";
import {
	checkManyPermissionMiddleware,
	checkPermissionMiddleware,
} from "@/lib/orpc/middlewares/permission";
import { createRelation, listAllowedEntities } from "@/lib/spice-db/actions";

export const listChats = authed.chat.list.handler(
	async ({ input, context }) => {
		const { entityIds } = await listAllowedEntities({
			userId: context.auth.user.id,
			action: "read",
			entityType: "chat",
			zedToken: input.zedToken,
		});

		const [data, [rowCount]] = await Promise.all([
			db
				.select({ ...getTableColumns(chat) })
				.from(chat)
				.where(inArray(chat.id, entityIds))
				.orderBy(desc(chat.createdAt))
				.limit(input.pageSize)
				.offset(input.pageIndex * input.pageSize),
			db
				.select({ count: count() })
				.from(chat)
				.where(inArray(chat.id, entityIds)),
		]);

		return { data, rowCount: rowCount.count };
	},
);

export const findChat = authed.chat.find
	.use(
		checkPermissionMiddleware,
		(input) =>
			({
				entityId: input.id,
				action: "read",
				entityType: "chat",
				zedToken: input.zedToken,
			}) as const,
	)
	.handler(async ({ input }) => {
		const [[data], branches] = await Promise.all([
			db
				.select({ ...getTableColumns(chat) })
				.from(chat)
				.where(eq(chat.id, input.id)),
			db
				.select({ ...getTableColumns(chatBranch) })
				.from(chatBranch)
				.where(eq(chatBranch.chatId, input.id))
				.orderBy(desc(chatBranch.updatedAt)),
		]);

		if (!data) {
			throw new ORPCError("NOT_FOUND", { message: "Chat not found" });
		}

		return {
			data: {
				...data,
				branches,
			},
		};
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

		// Create initial "Main" branch
		const [mainBranch] = await db
			.insert(chatBranch)
			.values({
				chatId: query.id,
				name: "Main",
				leafMessageId: null,
			})
			.returning();

		// Set active branch and create relation concurrently
		const [, relationResult] = await Promise.all([
			db
				.update(chat)
				.set({ activeBranchId: mainBranch.id })
				.where(eq(chat.id, query.id)),
			createRelation({
				entityId: query.id,
				entityType: "chat",
				userId: context.auth.user.id,
				relation: "owner",
			}),
		]);

		return {
			data: { ...query, activeBranchId: mainBranch.id },
			meta: { zedToken: relationResult.data.zedToken },
		};
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
		const updateData: {
			title?: string;
			activeBranchId?: string;
			updatedAt: Date;
		} = {
			updatedAt: new Date(),
		};

		if (input.title !== undefined) {
			updateData.title = input.title;
		}

		if (input.activeBranchId !== undefined) {
			updateData.activeBranchId = input.activeBranchId;
		}

		const [query] = await db
			.update(chat)
			.set(updateData)
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
		const logger = getLogger(context);
		logger?.info({ ids: context.allowedIds }, "Deleting chats by IDs");

		// Check if there are any IDs to delete
		if (!context.allowedIds || context.allowedIds.length === 0) {
			return { success: true, message: "No chats to delete" };
		}

		try {
			await db.delete(chat).where(inArray(chat.id, context.allowedIds));

			return { success: true, message: "Chats deleted successfully" };
		} catch (error) {
			logger?.error({ error }, "Error deleting chats:");
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to delete chats",
			});
		}
	});
