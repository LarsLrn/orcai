import { DB, dbSchema } from "@orcai/db";
import type { Block } from "@orcai/schema";
import {
	checkEntityPermission,
	checkManyEntityPermissions,
	hasPermission,
} from "@orcai/spice-db";
import { and, eq } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { authed } from "@/lib/orpc/implementation/authed";
import { requireEntityPermission } from "@/lib/orpc/middlewares/permission";

export const listChatBlocks = authed.chatBlock.list
	.use(
		requireEntityPermission("chat", "read", {
			entityId: "chatId",
			zedToken: "zedToken",
		}),
	)
	.effect(function* ({ input, context }) {
		const db = yield* DB;
		const resolvedZedToken = input.zedToken ?? context.meta?.zedToken;

		const chatBlocks = yield* db.query.chatBlock.findMany({
			where: {
				chatId: {
					eq: input.chatId,
				},
			},
		});

		if (chatBlocks.length === 0) {
			return {
				data: [] as Block[],
			};
		}

		const blockIds = chatBlocks.map((cb) => cb.blockId);
		const blocks = yield* db.query.block.findMany({
			where: {
				id: {
					in: blockIds,
				},
			},
		});
		if (blocks.length === 0) {
			return {
				data: [] as Block[],
			};
		}

		const usePermissionResult = yield* checkManyEntityPermissions({
			entityIds: blocks.map((block) => block.id),
			entityType: "block",
			permission: "use",
			userId: context.auth.user.id,
			zedToken: resolvedZedToken,
		});

		const parseAllowedIds = (result: typeof usePermissionResult) =>
			result.pairs
				.map((pair) => {
					const allowed =
						pair.response.oneofKind === "item" &&
						hasPermission({
							permissionship: pair.response.item.permissionship,
						}) === true;
					const id = pair.request?.resource?.objectId;
					return allowed && id ? id : undefined;
				})
				.filter((id): id is string => id !== undefined);

		const allowedBlockIds = new Set(parseAllowedIds(usePermissionResult));

		return {
			data: blocks.filter((block) => allowedBlockIds.has(block.id)) as Block[],
		};
	});

export const attachChatBlock = authed.chatBlock.attach
	.use(
		requireEntityPermission("chat", "edit", {
			entityId: "chatId",
			zedToken: "zedToken",
		}),
	)
	.effect(function* ({ input, context, errors }) {
		const db = yield* DB;
		const resolvedZedToken = input.zedToken ?? context.meta?.zedToken;
		const chat = yield* db.query.chat.findFirst({
			where: {
				id: {
					eq: input.chatId,
				},
			},
		});

		if (!chat) {
			return yield* Effect.fail(
				errors.BAD_REQUEST({
					message: "Chat not found",
				}),
			);
		}

		if (chat.botId) {
			return yield* Effect.fail(
				errors.BAD_REQUEST({
					message: "Cannot attach blocks directly to chats linked to a bot.",
				}),
			);
		}

		const canUseBlock = yield* checkEntityPermission({
			entityId: input.blockId,
			entityType: "block",
			permission: "use",
			userId: context.auth.user.id,
			zedToken: resolvedZedToken,
		});

		if (hasPermission(canUseBlock) === false) {
			return yield* Effect.fail(
				errors.FORBIDDEN({
					data: {
						allowed: false,
						permission: "use",
						entityType: "block",
						zedToken: resolvedZedToken,
					},
				}),
			);
		}

		const block = yield* db.query.block
			.findFirst({
				where: {
					id: {
						eq: input.blockId,
					},
				},
			})
			.pipe(
				Effect.flatMap((block) =>
					Effect.fromNullishOr(block).pipe(
						Effect.mapError(() =>
							errors.BAD_REQUEST({
								message: "Block not found",
							}),
						),
					),
				),
			);

		if (block.type === "template") {
			const existingTemplateAttachments = yield* db
				.select({
					blockId: dbSchema.chatBlock.blockId,
				})
				.from(dbSchema.chatBlock)
				.innerJoin(
					dbSchema.block,
					eq(dbSchema.block.id, dbSchema.chatBlock.blockId),
				)
				.where(
					and(
						eq(dbSchema.chatBlock.chatId, input.chatId),
						eq(dbSchema.block.type, "template"),
					),
				);

			const hasOtherTemplate = existingTemplateAttachments.some(
				(attachment) => attachment.blockId !== input.blockId,
			);

			if (hasOtherTemplate) {
				return yield* Effect.fail(
					errors.BAD_REQUEST({
						message:
							"This chat already has a template block attached. Remove it before attaching another one.",
					}),
				);
			}
		}

		const [chatBlock] = yield* db
			.insert(dbSchema.chatBlock)
			.values({
				chatId: input.chatId,
				blockId: input.blockId,
			})
			.onConflictDoNothing()
			.returning();

		return {
			data: chatBlock ?? {
				chatId: input.chatId,
				blockId: input.blockId,
				createdAt: new Date(),
			},
		};
	});

export const detachChatBlock = authed.chatBlock.detach
	.use(
		requireEntityPermission("chat", "edit", {
			entityId: "chatId",
			zedToken: "zedToken",
		}),
	)
	.effect(function* ({ input, errors }) {
		const db = yield* DB;
		const chat = yield* db.query.chat.findFirst({
			where: {
				id: {
					eq: input.chatId,
				},
			},
		});

		if (!chat) {
			return yield* Effect.fail(
				errors.BAD_REQUEST({
					message: "Chat not found",
				}),
			);
		}

		if (chat.botId) {
			return yield* Effect.fail(
				errors.BAD_REQUEST({
					message: "Cannot detach blocks directly from chats linked to a bot.",
				}),
			);
		}

		yield* db
			.delete(dbSchema.chatBlock)
			.where(
				and(
					eq(dbSchema.chatBlock.chatId, input.chatId),
					eq(dbSchema.chatBlock.blockId, input.blockId),
				),
			);

		return {
			success: true,
			message: "Block detached from chat",
		};
	});
