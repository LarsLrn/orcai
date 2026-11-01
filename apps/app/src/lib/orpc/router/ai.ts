import { DB } from "@orcai/db";
import { streamToEventIterator } from "@orpc/client";
import * as Effect from "effect/Effect";
import { DrizzleReplyStore } from "@/lib/ai/turn/drizzle-reply-store";
import { continueTurn, keepUploads, startTurn } from "@/lib/ai/turn/turn";
import { ownUploads } from "@/lib/assets/own-uploads";
import { getZedToken, recordZedToken } from "@/lib/authz/zed-token";
import { authed } from "@/lib/orpc/implementation/authed";
import { requireActiveOrganizationMiddleware } from "@/lib/orpc/middlewares/auth";
import { requireEntityPermission } from "@/lib/orpc/middlewares/permission";

const requireChatEdit = requireEntityPermission("chat", "edit", {
	entityId: "chatId",
	zedToken: "zedToken",
});

const aiChat = authed.ai.chat
	.use(requireActiveOrganizationMiddleware)
	.use(requireChatEdit)
	.effect(function* ({ input, context, signal }) {
		const stream = yield* startTurn({
			chatId: input.chatId,
			message: input.message,
			organizationId: context.auth.session.activeOrganizationId,
			user: {
				id: context.auth.user.id,
				name: context.auth.user.name,
				email: context.auth.user.email,
			},
			timeZone: input.timeZone,
			context: {
				...context,
				meta: {
					...context.meta,
					zedToken: getZedToken(context, input),
				},
			},
			stop: signal,
		}).pipe(Effect.provide(DrizzleReplyStore));

		return streamToEventIterator(stream);
	});

const aiContinue = authed.ai.continue
	.use(requireActiveOrganizationMiddleware)
	.use(requireChatEdit)
	.effect(function* ({ input, context, signal }) {
		const stream = yield* continueTurn({
			chatId: input.chatId,
			replyId: input.messageId,
			decisions: input.approvals,
			toolOutputs: input.toolOutputs,
			clientZedToken: input.zedToken,
			organizationId: context.auth.session.activeOrganizationId,
			user: {
				id: context.auth.user.id,
				name: context.auth.user.name,
				email: context.auth.user.email,
			},
			timeZone: input.timeZone,
			context: {
				...context,
				meta: {
					...context.meta,
					zedToken: getZedToken(context, input),
				},
			},
			stop: signal,
		}).pipe(Effect.provide(DrizzleReplyStore));

		return streamToEventIterator(stream);
	});

const aiKeepUploads = authed.ai.keepUploads
	.use(requireActiveOrganizationMiddleware)
	.use(requireChatEdit)
	.effect(function* ({ input, context }) {
		const organizationId = context.auth.session.activeOrganizationId;
		const assets = yield* ownUploads(input.assetIds, {
			userId: context.auth.user.id,
			organizationId,
			zedToken: getZedToken(context, input),
		});
		const data = yield* keepUploads({
			chatId: input.chatId,
			organizationId,
			context,
			replyId: input.messageId,
			toolCallId: input.toolCallId,
			kept: {
				assets,
				zedToken: input.zedToken,
			},
		}).pipe(Effect.provide(DrizzleReplyStore));

		return {
			data,
		};
	});

/**
 * A streamed turn's response is under way before its tools write, so the
 * stored reply's token reaches the cookie here, after the turn.
 */
const aiRecordTurnWrites = authed.ai.recordTurnWrites
	.use(
		requireEntityPermission("chat", "read", {
			entityId: "chatId",
			zedToken: "zedToken",
		}),
	)
	.effect(function* ({ input }) {
		const db = yield* DB;
		const reply = yield* db.query.chatMessage.findFirst({
			columns: {
				metadata: true,
			},
			where: {
				id: input.messageId,
				chatId: input.chatId,
			},
		});
		yield* recordZedToken(reply?.metadata?.zedToken);

		return {
			success: true,
		};
	});

export const aiRouter = {
	chat: aiChat,
	continue: aiContinue,
	keepUploads: aiKeepUploads,
	recordTurnWrites: aiRecordTurnWrites,
};
