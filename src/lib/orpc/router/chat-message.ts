import { ORPCError } from "@orpc/server";
import {
	and,
	count,
	eq,
	getTableColumns,
	inArray,
	isNull,
	or,
	sql,
} from "drizzle-orm";
import type { ApiGetScoresResponse } from "langfuse";
import { db } from "@/db/drizzle";
import { chat } from "@/db/schema/chat";
import { chatBranch } from "@/db/schema/chat-branch";
import { chatMessage } from "@/db/schema/chat-message";
import { langfuseServer } from "@/lib/langfuse/langfuse-server";
import { authed } from "@/lib/orpc";
import { checkPermissionMiddleware } from "@/lib/orpc/middlewares/permission";
import type { ChatMessage } from "@/lib/orpc/schemas/chat-message";

export const listChatMessages = authed.chatMessage.list
	.use(
		checkPermissionMiddleware,
		(input) =>
			({
				entityId: input.chatId,
				action: "read",
				entityType: "chat",
				zedToken: input.zedToken,
			}) as const,
	)
	.handler(async ({ input }) => {
		if (!input.branchId) {
			throw new ORPCError("BAD_REQUEST", {
				message: "branchId is required to list messages",
			});
		}

		let data: ChatMessage[] = [];

		const [branch] = await db
			.select()
			.from(chatBranch)
			.where(eq(chatBranch.id, input.branchId));

		if (!branch) {
			throw new ORPCError("NOT_FOUND", { message: "Branch not found" });
		}

		// Recursive CTE to get the linear history
		//TODO: Keep an eye out for drizzle support: https://github.com/drizzle-team/drizzle-orm/pull/1405
		const query = sql`
			WITH RECURSIVE message_tree AS (
				SELECT * FROM ${chatMessage} WHERE ${chatMessage.id} = ${branch.leafMessageId}
				UNION ALL
				SELECT parent.* FROM ${chatMessage} parent
				INNER JOIN message_tree child ON child.parent_message_id = parent.id
			)
			SELECT * FROM message_tree ORDER BY depth ASC 
			LIMIT ${input.pageSize} OFFSET ${input.pageIndex * input.pageSize}
		`;

		const result = await db.execute(query);
		data = result.rows.map(
			(row: any): ChatMessage => ({
				id: row.id,
				chatId: row.chat_id,
				role: row.role,
				parts: row.parts,
				attachments: row.attachments,
				metadata: row.metadata,
				createdAt: row.created_at ? new Date(row.created_at) : new Date(),
				parentMessageId: row.parent_message_id,
				depth: row.depth,
			}),
		);

		// Augment with sibling info
		if (data.length > 0) {
			const parentIds = [...new Set(data.map((m) => m.parentMessageId))];
			const hasRoot = parentIds.includes(null);
			const validParentIds = parentIds.filter((id) => id !== null) as string[];

			const siblings = await db
				.select({
					id: chatMessage.id,
					parentMessageId: chatMessage.parentMessageId,
					createdAt: chatMessage.createdAt,
				})
				.from(chatMessage)
				.where(
					and(
						eq(chatMessage.chatId, input.chatId),
						or(
							validParentIds.length > 0
								? inArray(chatMessage.parentMessageId, validParentIds)
								: undefined,
							hasRoot ? isNull(chatMessage.parentMessageId) : undefined,
						),
					),
				);

			const siblingsByParent = new Map<string | null, typeof siblings>();
			for (const s of siblings) {
				const p = s.parentMessageId;
				if (!siblingsByParent.has(p)) siblingsByParent.set(p, []);
				const list = siblingsByParent.get(p);
				if (list) list.push(s);
			}

			for (const list of siblingsByParent.values()) {
				list.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
			}

			data = data.map((m) => {
				const sList = siblingsByParent.get(m.parentMessageId) || [];
				const count = sList.length;
				if (count <= 1) return m;

				const index = sList.findIndex((s) => s.id === m.id) + 1;
				const siblingIds = sList.map((s) => s.id);

				return {
					...m,
					metadata: {
						...(m.metadata as object),
						siblingCount: count,
						siblingIndex: index,
						siblingIds,
					},
				};
			});
		}

		// Get total count for pagination - count messages in this branch's history
		const [rowCount] = await db
			.select({ count: count() })
			.from(chatMessage)
			.where(eq(chatMessage.chatId, input.chatId));

		let scores: ApiGetScoresResponse = {
			data: [],
			meta: { page: 0, totalItems: 0, limit: 0, totalPages: 0 },
		};

		if (input.includeScores && data.length > 0) {
			try {
				scores = await langfuseServer.api.scoreV2Get({
					scoreIds: data
						.map((message) =>
							message.role !== "user" ? message.id : undefined,
						)
						.filter(Boolean)
						.join(","),
				});
			} catch (error) {
				console.error("Error fetching scores from Langfuse:", error);
			}
		}

		return { data, rowCount: rowCount.count, scores };
	});

export const findChatMessage = authed.chatMessage.find
	.use(
		checkPermissionMiddleware,
		(input) =>
			({
				entityId: input.chatId,
				action: "read",
				entityType: "chat",
				zedToken: input.zedToken,
			}) as const,
	)
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

export const getBranchIdForMessage = authed.chatMessage.getBranch
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
		// Find the best branch that leads to or descends from the given message
		// We look for any branch where the leaf is a descendant of messageId
		const result = await db.execute(sql`
			WITH RECURSIVE descendants AS (
				SELECT id FROM ${chatMessage} WHERE ${chatMessage.id} = ${input.messageId}
				UNION ALL
				SELECT c.id FROM ${chatMessage} c
				INNER JOIN descendants d ON d.id = c.parent_message_id
			)
			SELECT ${chatBranch.id} 
			FROM ${chatBranch} 
			WHERE ${chatBranch.leafMessageId} IN (SELECT id FROM descendants)
			AND ${chatBranch.chatId} = ${input.chatId}
			ORDER BY ${chatBranch.updatedAt} DESC
			LIMIT 1
		`);

		if (result.rows.length === 0) {
			throw new ORPCError("NOT_FOUND", {
				message: "No branch found context for this message",
			});
		}

		// Drizzle execute returns weird type
		const branchId = (result.rows[0] as any).id;
		return { branchId };
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
		if (!input.branchId) {
			throw new ORPCError("BAD_REQUEST", {
				message: "branchId is required",
			});
		}

		// 1. Determine parent and depth
		let parentMessageId = input.parentMessageId;
		let depth = 0;
		const branchIdToUpdate = input.branchId;

		// Get current branch to determine leaf
		const [branch] = await db
			.select()
			.from(chatBranch)
			.where(eq(chatBranch.id, branchIdToUpdate));

		if (!branch) {
			throw new ORPCError("NOT_FOUND", {
				message: "Branch not found",
			});
		}

		const currentBranchLeafId = branch.leafMessageId;

		// If no manual parent specified, use branch leaf
		if (!parentMessageId) {
			parentMessageId = currentBranchLeafId;
		}

		// Calculate depth from parent
		if (parentMessageId) {
			const [parent] = await db
				.select()
				.from(chatMessage)
				.where(eq(chatMessage.id, parentMessageId));
			if (parent) {
				depth = parent.depth + 1;
			}
		}

		// 2. Check for branching (Fork Logic)
		// We fork if we're inserting at a point that's not the current branch tip
		// However, we should check if the parent is actually part of this branch's history
		let isForking = false;

		if (branchIdToUpdate && parentMessageId && currentBranchLeafId) {
			if (parentMessageId !== currentBranchLeafId) {
				// Check if parentMessageId is in the branch's history (ancestor of current leaf)
				// If it is, this is a regeneration/edit scenario, so we should fork
				const isAncestor = await db
					.execute(sql`
						WITH RECURSIVE ancestors AS (
							SELECT id, parent_message_id FROM ${chatMessage} WHERE id = ${currentBranchLeafId}
							UNION ALL
							SELECT parent.id, parent.parent_message_id 
							FROM ${chatMessage} parent
							INNER JOIN ancestors ON ancestors.parent_message_id = parent.id
						)
						SELECT EXISTS(SELECT 1 FROM ancestors WHERE id = ${parentMessageId}) as is_ancestor
					`)
					.then((res: any) => res.rows[0]?.is_ancestor ?? false);

				isForking = isAncestor;
			}
		}

		// 3. Insert Message
		const [query] = await db
			.insert(chatMessage)
			.values({
				...input,
				parentMessageId,
				depth,
				createdAt: new Date(),
			})
			.returning({ ...getTableColumns(chatMessage) });

		// 4. Handle Branch Updates
		if (isForking) {
			// Create a new branch
			const [countRes] = await db
				.select({ count: count() })
				.from(chatBranch)
				.where(eq(chatBranch.chatId, input.chatId));

			const [newBranch] = await db
				.insert(chatBranch)
				.values({
					chatId: input.chatId,
					name: `Branch ${countRes.count + 1}`,
					leafMessageId: query.id,
				})
				.returning();

			// Set the new branch as active
			await db
				.update(chat)
				.set({
					activeBranchId: newBranch.id,
					updatedAt: new Date(),
				})
				.where(eq(chat.id, input.chatId));

			return { data: query, branchId: newBranch.id };
		}

		// Extend the existing branch
		await db
			.update(chatBranch)
			.set({
				leafMessageId: query.id,
				updatedAt: new Date(),
			})
			.where(eq(chatBranch.id, branchIdToUpdate));

		await db
			.update(chat)
			.set({ updatedAt: new Date() })
			.where(eq(chat.id, input.chatId));

		return { data: query, branchId: branchIdToUpdate };
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
		// 1. Get target message to check if it has children
		const [targetMsg] = await db
			.select()
			.from(chatMessage)
			.where(
				and(eq(chatMessage.id, input.id), eq(chatMessage.chatId, input.chatId)),
			);

		if (!targetMsg) {
			throw new ORPCError("NOT_FOUND", { message: "Message not found" });
		}

		// 2. Check for children (indicating this message is not a leaf)
		const [childCount] = await db
			.select({ count: count() })
			.from(chatMessage)
			.where(eq(chatMessage.parentMessageId, targetMsg.id));

		const hasChildren = childCount.count > 0;

		if (!hasChildren) {
			// Case A: Leaf message - Edit in place
			const [query] = await db
				.update(chatMessage)
				.set({
					parts: input.parts,
					attachments: input.attachments,
					metadata: input.metadata,
				})
				.where(eq(chatMessage.id, input.id))
				.returning({ ...getTableColumns(chatMessage) });

			await db
				.update(chat)
				.set({ updatedAt: new Date() })
				.where(eq(chat.id, input.chatId));

			return { data: query, branchId: input.branchId };
		}

		// Case B: Non-leaf message - Fork by creating a new message
		// This duplicates some logic from createChatMessage, but keeps it self-contained
		const newMessageId = input.id; // Can reuse or generate new
		const depth = targetMsg.depth;

		const [newMessage] = await db
			.insert(chatMessage)
			.values({
				id: newMessageId,
				chatId: input.chatId,
				role: targetMsg.role,
				parts: input.parts ?? targetMsg.parts,
				attachments: input.attachments ?? targetMsg.attachments,
				metadata: input.metadata ?? targetMsg.metadata,
				parentMessageId: targetMsg.parentMessageId,
				depth,
				createdAt: new Date(),
			})
			.returning({ ...getTableColumns(chatMessage) });

		// Create new branch
		const [countRes] = await db
			.select({ count: count() })
			.from(chatBranch)
			.where(eq(chatBranch.chatId, input.chatId));

		const [newBranch] = await db
			.insert(chatBranch)
			.values({
				chatId: input.chatId,
				name: `Branch ${countRes.count + 1}`,
				leafMessageId: newMessage.id,
			})
			.returning();

		// Set as active branch
		await db
			.update(chat)
			.set({
				activeBranchId: newBranch.id,
				updatedAt: new Date(),
			})
			.where(eq(chat.id, input.chatId));

		return { data: newMessage, branchId: newBranch.id };
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

		return {
			success: true,
			message: "Message rated successfully",
			data: input,
		};
	});
