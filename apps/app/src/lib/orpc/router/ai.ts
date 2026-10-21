import { streamToEventIterator } from "@orpc/client";
import * as Effect from "effect/Effect";
import { DrizzleReplyStore } from "@/lib/ai/turn/drizzle-reply-store";
import { continueTurn, startTurn } from "@/lib/ai/turn/turn";
import { getZedToken } from "@/lib/authz/zed-token";
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

export const aiRouter = {
	chat: aiChat,
	continue: aiContinue,
};
