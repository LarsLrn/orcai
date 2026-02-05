import { ORPCError } from "@orpc/server";
import {
	and,
	count,
	eq,
	getColumns,
	inArray,
	isNull,
	or,
	sql,
} from "drizzle-orm";
import * as Effect from "effect/Effect";
import type { ApiGetScoresResponse } from "langfuse";
import { db } from "@/db/drizzle";
import { dbSchema } from "@/db/schema";
import { DB } from "@/lib/effect/services/drizzle";
import { runOrpcEffect } from "@/lib/effect/utils/orpc-helpers";
import { langfuseServer } from "@/lib/langfuse/langfuse-server";
import { authed } from "@/lib/orpc/implementation/authed";
import {
	type CheckPermissionInput,
	checkPermissionMiddleware,
} from "@/lib/orpc/middlewares/permission";
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
			}) satisfies CheckPermissionInput,
	)
	.handler(async ({ input, errors }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;

				const branch = yield* db.query.chatBranch
					.findFirst({
						where: {
							id: input.branchId,
						},
					})
					.pipe(
						Effect.flatMap((chat) =>
							Effect.fromNullable(chat).pipe(
								Effect.orElse(() =>
									Effect.fail(
										errors.NOT_FOUND({ message: "Branch not found" }),
									),
								),
							),
						),
					);

				const result = yield* db.execute(sql`
					WITH RECURSIVE message_tree AS (
						SELECT * FROM ${dbSchema.chatMessage} WHERE ${dbSchema.chatMessage.id} = ${branch.leafMessageId}
						UNION ALL
						SELECT parent.* FROM ${dbSchema.chatMessage} parent
						INNER JOIN message_tree child ON child.parent_message_id = parent.id
					)
					SELECT * FROM message_tree ORDER BY depth ASC 
					LIMIT ${input.pageSize} OFFSET ${input.pageIndex * input.pageSize}
				`);

				let chatMessages = result.map(
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

				if (chatMessages.length > 0) {
					const parentIds = [
						...new Set(chatMessages.map((m) => m.parentMessageId)),
					];
					const hasRoot = parentIds.includes(null);
					const validParentIds = parentIds.filter(
						(id) => id !== null,
					) as string[];

					const siblings = yield* db
						.select({
							id: dbSchema.chatMessage.id,
							parentMessageId: dbSchema.chatMessage.parentMessageId,
							createdAt: dbSchema.chatMessage.createdAt,
						})
						.from(dbSchema.chatMessage)
						.where(
							and(
								eq(dbSchema.chatMessage.chatId, input.chatId),
								or(
									validParentIds.length > 0
										? inArray(
												dbSchema.chatMessage.parentMessageId,
												validParentIds,
											)
										: undefined,
									hasRoot
										? isNull(dbSchema.chatMessage.parentMessageId)
										: undefined,
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

					chatMessages = chatMessages.map((m) => {
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

				const [rowCount] = yield* db
					.select({ count: count() })
					.from(dbSchema.chatMessage)
					.where(eq(dbSchema.chatMessage.chatId, input.chatId));

				let scores: ApiGetScoresResponse = {
					data: [],
					meta: { page: 0, totalItems: 0, limit: 0, totalPages: 0 },
				};

				if (input.includeScores && chatMessages.length > 0) {
					scores = yield* Effect.tryPromise({
						try: () =>
							langfuseServer.api.scoreV2Get({
								scoreIds: chatMessages
									.map((message) =>
										message.role !== "user" ? message.id : undefined,
									)
									.filter(Boolean)
									.join(","),
							}),
						catch: () =>
							errors.BAD_REQUEST({
								message: "Error fetching scores from Langfuse",
							}),
					});
				}

				return { data: chatMessages, rowCount: rowCount.count, scores };
			}),
		),
	);

export const findChatMessage = authed.chatMessage.find
	.use(
		checkPermissionMiddleware,
		(input) =>
			({
				entityId: input.chatId,
				action: "read",
				entityType: "chat",
				zedToken: input.zedToken,
			}) satisfies CheckPermissionInput,
	)
	.handler(async ({ input, errors }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;

				return yield* db.query.chatMessage
					.findFirst({
						where: {
							AND: [{ id: input.id }, { chatId: input.chatId }],
						},
					})
					.pipe(
						Effect.flatMap((chat) =>
							Effect.fromNullable(chat).pipe(
								Effect.orElse(() =>
									Effect.fail(
										errors.NOT_FOUND({ message: "Chat message not found" }),
									),
								),
							),
						),
						Effect.map((chat) => ({ data: chat })),
					);
			}),
		),
	);

export const getBranchIdForMessage = authed.chatMessage.getBranch
	.use(
		checkPermissionMiddleware,
		(input) =>
			({
				entityId: input.chatId,
				action: "read",
				entityType: "chat",
			}) satisfies CheckPermissionInput,
	)
	.handler(async ({ input, errors }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;

				return yield* db
					.execute(sql`
						WITH RECURSIVE descendants AS (
							SELECT id FROM ${dbSchema.chatMessage} WHERE ${dbSchema.chatMessage.id} = ${input.messageId}
							UNION ALL
							SELECT c.id FROM ${dbSchema.chatMessage} c
							INNER JOIN descendants d ON d.id = c.parentMessageId
						)
						SELECT ${dbSchema.chatBranch.id} 
						FROM ${dbSchema.chatBranch} 
						WHERE ${dbSchema.chatBranch.leafMessageId} IN (SELECT id FROM descendants)
						AND ${dbSchema.chatBranch.chatId} = ${input.chatId}
						ORDER BY ${dbSchema.chatBranch.updatedAt} DESC
						LIMIT 1
					`)
					.pipe(
						Effect.map((result) => {
							if (result.length === 0) {
								return null;
							}
							// Drizzle execute returns weird type
							const branchId = (result[0] as any).id as string;
							return { branchId };
						}),
						Effect.flatMap((branch) =>
							Effect.fromNullable(branch).pipe(
								Effect.orElse(() =>
									Effect.fail(
										errors.NOT_FOUND({
											message: "No branch found context for this message",
										}),
									),
								),
							),
						),
					);
			}),
		),
	);

export const createChatMessage = authed.chatMessage.create
	.use(
		checkPermissionMiddleware,
		(input) =>
			({
				entityId: input.chatId,
				action: "update",
				entityType: "chat",
			}) satisfies CheckPermissionInput,
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
			.from(dbSchema.chatBranch)
			.where(eq(dbSchema.chatBranch.id, branchIdToUpdate));

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
				.from(dbSchema.chatMessage)
				.where(eq(dbSchema.chatMessage.id, parentMessageId));
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
							SELECT id, parentMessageId FROM ${dbSchema.chatMessage} WHERE id = ${currentBranchLeafId}
							UNION ALL
							SELECT parent.id, parent.parentMessageId 
							FROM ${dbSchema.chatMessage} parent
							INNER JOIN ancestors ON ancestors.parentMessageId = parent.id
						)
						SELECT EXISTS(SELECT 1 FROM ancestors WHERE id = ${parentMessageId}) as is_ancestor
					`)
					.then((res: any) => res.rows[0]?.is_ancestor ?? false);

				isForking = isAncestor;
			}
		}

		// 3. Insert Message
		const [query] = await db
			.insert(dbSchema.chatMessage)
			.values({
				...input,
				parentMessageId,
				depth,
				createdAt: new Date(),
			})
			.returning({ ...getColumns(dbSchema.chatMessage) });

		// 4. Handle Branch Updates
		if (isForking) {
			// Create a new branch
			const [countRes] = await db
				.select({ count: count() })
				.from(dbSchema.chatBranch)
				.where(eq(dbSchema.chatBranch.chatId, input.chatId));

			const [newBranch] = await db
				.insert(dbSchema.chatBranch)
				.values({
					chatId: input.chatId,
					name: `Branch ${countRes.count + 1}`,
					leafMessageId: query.id,
				})
				.returning();

			// Set the new branch as active
			await db
				.update(dbSchema.chat)
				.set({
					activeBranchId: newBranch.id,
					updatedAt: new Date(),
				})
				.where(eq(dbSchema.chat.id, input.chatId));

			return { data: query, branchId: newBranch.id };
		}

		// Extend the existing branch
		await db
			.update(dbSchema.chatBranch)
			.set({
				leafMessageId: query.id,
				updatedAt: new Date(),
			})
			.where(eq(dbSchema.chatBranch.id, branchIdToUpdate));

		await db
			.update(dbSchema.chat)
			.set({ updatedAt: new Date() })
			.where(eq(dbSchema.chat.id, input.chatId));

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
			}) satisfies CheckPermissionInput,
	)
	.handler(async ({ input }) => {
		// 1. Get target message to check if it has children
		const [targetMsg] = await db
			.select()
			.from(dbSchema.chatMessage)
			.where(
				and(
					eq(dbSchema.chatMessage.id, input.id),
					eq(dbSchema.chatMessage.chatId, input.chatId),
				),
			);

		if (!targetMsg) {
			throw new ORPCError("NOT_FOUND", { message: "Message not found" });
		}

		// 2. Check for children (indicating this message is not a leaf)
		const [childCount] = await db
			.select({ count: count() })
			.from(dbSchema.chatMessage)
			.where(eq(dbSchema.chatMessage.parentMessageId, targetMsg.id));

		const hasChildren = childCount.count > 0;

		if (!hasChildren) {
			// Case A: Leaf message - Edit in place
			const [query] = await db
				.update(dbSchema.chatMessage)
				.set({
					parts: input.parts,
					attachments: input.attachments,
					metadata: input.metadata,
				})
				.where(eq(dbSchema.chatMessage.id, input.id))
				.returning({ ...getColumns(dbSchema.chatMessage) });

			await db
				.update(dbSchema.chat)
				.set({ updatedAt: new Date() })
				.where(eq(dbSchema.chat.id, input.chatId));

			return { data: query, branchId: input.branchId };
		}

		// Case B: Non-leaf message - Fork by creating a new message
		// This duplicates some logic from createChatMessage, but keeps it self-contained
		const newMessageId = input.id; // Can reuse or generate new
		const depth = targetMsg.depth;

		const [newMessage] = await db
			.insert(dbSchema.chatMessage)
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
			.returning({ ...getColumns(dbSchema.chatMessage) });

		// Create new branch
		const [countRes] = await db
			.select({ count: count() })
			.from(dbSchema.chatBranch)
			.where(eq(dbSchema.chatBranch.chatId, input.chatId));

		const [newBranch] = await db
			.insert(dbSchema.chatBranch)
			.values({
				chatId: input.chatId,
				name: `Branch ${countRes.count + 1}`,
				leafMessageId: newMessage.id,
			})
			.returning();

		// Set as active branch
		await db
			.update(dbSchema.chat)
			.set({
				activeBranchId: newBranch.id,
				updatedAt: new Date(),
			})
			.where(eq(dbSchema.chat.id, input.chatId));

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
			}) satisfies CheckPermissionInput,
	)
	.handler(async ({ input }) =>
		runOrpcEffect(
			Effect.gen(function* () {
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

				return { success: true, message: "Chat messages deleted successfully" };
			}),
		),
	);

export const rateChatMessage = authed.chatMessage.rate
	.use(
		checkPermissionMiddleware,
		(input) =>
			({
				entityId: input.chatId,
				action: "update",
				entityType: "chat",
			}) satisfies CheckPermissionInput,
	)
	.handler(({ input }) => {
		langfuseServer.score({
			id: input.id,
			traceId: input.id,
			name: "rate_helpfulness",
			value: input.sentiment,
			environment:
				process.env.NODE_ENV === "production" ? "production" : "development",
		});

		return {
			success: true,
			message: "Message rated successfully",
			data: input,
		};
	});
