import { DB, dbSchema } from "@orcai/db";
import type { Block } from "@orcai/schema";
import { and, eq } from "drizzle-orm";
import * as Effect from "effect/Effect";
import {
	requireUsableInOrganization,
	usableInOrganization,
} from "@/lib/authz/organization-use";
import { getZedToken } from "@/lib/authz/zed-token";
import { chatBotUsable, requireWritableChat } from "@/lib/chats/read-only";
import * as AppErrors from "@/lib/effect/utils/errors";
import { authed } from "@/lib/orpc/implementation/authed";
import { requireActiveOrganizationMiddleware } from "@/lib/orpc/middlewares/auth";
import { requireEntityPermission } from "@/lib/orpc/middlewares/permission";
import { assistantConversationImmutable } from "./helpers/assistant-conversation";

const listChatBlocks = authed.chatBlock.list
	.use(
		requireEntityPermission("chat", "read", {
			entityId: "chatId",
			zedToken: "zedToken",
		}),
	)
	.effect(function* ({ input, context }) {
		const db = yield* DB;
		const resolvedZedToken = getZedToken(context, input);

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

		const [chat] = yield* db
			.select({
				organizationId: dbSchema.chat.organizationId,
			})
			.from(dbSchema.chat)
			.where(eq(dbSchema.chat.id, input.chatId));
		const allowedBlockIds = yield* usableInOrganization({
			resourceType: "block",
			resourceIds: blocks.map((block) => block.id),
			userId: context.auth.user.id,
			organizationId: chat?.organizationId,
			zedToken: resolvedZedToken,
		});

		return {
			data: blocks.filter((block) => allowedBlockIds.has(block.id)) as Block[],
		};
	});

const attachChatBlock = authed.chatBlock.attach
	.use(requireActiveOrganizationMiddleware)
	.use(
		requireEntityPermission("chat", "edit", {
			entityId: "chatId",
			zedToken: "zedToken",
		}),
	)
	.effect(function* ({ input, context }) {
		const db = yield* DB;
		const resolvedZedToken = getZedToken(context, input);
		const chat = yield* db.query.chat.findFirst({
			where: {
				id: {
					eq: input.chatId,
				},
			},
		});

		if (!chat) {
			return yield* Effect.fail(
				new AppErrors.NotFoundError({
					reason: "CHAT_NOT_FOUND",
					id: input.chatId,
					message: "Chat not found",
				}),
			);
		}

		if (chat.kind === "assistant") {
			return yield* Effect.fail(assistantConversationImmutable());
		}
		yield* requireWritableChat(chat, {
			activeOrganizationId: context.auth.session.activeOrganizationId,
			botUsable: chatBotUsable(chat, {
				userId: context.auth.user.id,
				zedToken: getZedToken(context, input),
			}),
		});

		if (chat.botId) {
			return yield* Effect.fail(
				new AppErrors.BadRequestError({
					reason: "CHAT_BOT_BLOCKS_IMMUTABLE",
					message: "Cannot attach blocks directly to chats linked to a bot.",
				}),
			);
		}

		yield* requireUsableInOrganization({
			resourceType: "block",
			resourceIds: [
				input.blockId,
			],
			userId: context.auth.user.id,
			organizationId: chat.organizationId,
			zedToken: resolvedZedToken,
		});

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
						Effect.mapError(
							() =>
								new AppErrors.NotFoundError({
									reason: "BLOCK_NOT_FOUND",
									id: input.blockId,
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
					new AppErrors.BadRequestError({
						reason: "CHAT_TEMPLATE_BLOCK_ALREADY_ATTACHED",
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

const detachChatBlock = authed.chatBlock.detach
	.use(requireActiveOrganizationMiddleware)
	.use(
		requireEntityPermission("chat", "edit", {
			entityId: "chatId",
			zedToken: "zedToken",
		}),
	)
	.effect(function* ({ input, context }) {
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
				new AppErrors.NotFoundError({
					reason: "CHAT_NOT_FOUND",
					id: input.chatId,
					message: "Chat not found",
				}),
			);
		}

		if (chat.kind === "assistant") {
			return yield* Effect.fail(assistantConversationImmutable());
		}
		yield* requireWritableChat(chat, {
			activeOrganizationId: context.auth.session.activeOrganizationId,
			botUsable: chatBotUsable(chat, {
				userId: context.auth.user.id,
				zedToken: getZedToken(context, input),
			}),
		});

		if (chat.botId) {
			return yield* Effect.fail(
				new AppErrors.BadRequestError({
					reason: "CHAT_BOT_BLOCKS_IMMUTABLE",
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

export const chatBlockRouter = {
	list: listChatBlocks,
	attach: attachChatBlock,
	detach: detachChatBlock,
};
