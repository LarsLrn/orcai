import * as Effect from "effect/Effect";
import { getZedToken } from "@/lib/authz/zed-token";
import {
	botSetupCoverage,
	canEditBotSetup,
	findBotSetup,
	requireBotSetupEditor,
	saveBotSetup,
} from "@/lib/bots/bot-setup";
import { authed } from "@/lib/orpc/implementation/authed";
import { requireActiveOrganizationMiddleware } from "@/lib/orpc/middlewares/auth";
import { requireEntityPermission } from "@/lib/orpc/middlewares/permission";

const findSetup = authed.botSetup.find
	.use(requireActiveOrganizationMiddleware)
	.use(
		requireEntityPermission("bot", "read", {
			entityId: "botId",
			zedToken: "zedToken",
		}),
	)
	.effect(function* ({ input, context }) {
		const [setup, canEdit] = yield* Effect.all(
			[
				findBotSetup({
					botId: input.botId,
					organizationId: context.auth.session.activeOrganizationId,
				}),
				canEditBotSetup({
					botId: input.botId,
					organizationId: context.auth.session.activeOrganizationId,
					userId: context.auth.user.id,
					zedToken: getZedToken(context, input),
				}),
			],
			{
				concurrency: "unbounded",
			},
		);

		return {
			data: {
				setup,
				canEdit,
			},
		};
	});

const saveSetup = authed.botSetup.save
	.use(requireActiveOrganizationMiddleware)
	.effect(function* ({ input, context }) {
		yield* requireBotSetupEditor({
			botId: input.botId,
			organizationId: context.auth.session.activeOrganizationId,
			userId: context.auth.user.id,
			zedToken: getZedToken(context, input),
		});
		return {
			data: yield* saveBotSetup({
				botId: input.botId,
				organizationId: context.auth.session.activeOrganizationId,
				userId: context.auth.user.id,
				setup: input.setup,
			}),
		};
	});

/** Only setup editors see who the bot is shared with and whether they are covered. */
const setupCoverage = authed.botSetup.coverage
	.use(requireActiveOrganizationMiddleware)
	.effect(function* ({ input, context }) {
		yield* requireBotSetupEditor({
			botId: input.botId,
			organizationId: context.auth.session.activeOrganizationId,
			userId: context.auth.user.id,
			zedToken: getZedToken(context, input),
		});
		return {
			data: yield* botSetupCoverage({
				botId: input.botId,
				organizationId: context.auth.session.activeOrganizationId,
				modelId: input.modelId,
				viewer: {
					userId: context.auth.user.id,
					zedToken: getZedToken(context, input),
				},
			}),
		};
	});

export const botSetupRouter = {
	find: findSetup,
	save: saveSetup,
	coverage: setupCoverage,
};
