import * as Effect from "effect/Effect";
import { readRevision } from "@/lib/authz/zed-token";
import {
	botSetupCoverage,
	canEditBotSetup,
	findBotSetup,
	requireBotSetupEditor,
	saveBotSetup,
} from "@/lib/bots/bot-setup";
import { authed } from "@/lib/orpc/implementation/authed";
import { requireOrganization } from "@/lib/orpc/middlewares/organization";
import { requireEntityAccess } from "@/lib/orpc/middlewares/permission";

const findSetup = authed.botSetup.find
	.use(requireOrganization())
	.use(
		requireEntityAccess("bot", "read", {
			entityId: "botId",
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
					zedToken: readRevision(context, input),
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
	.use(requireOrganization())
	.effect(function* ({ input, context }) {
		return {
			data: yield* saveBotSetup({
				botId: input.botId,
				organizationId: context.auth.session.activeOrganizationId,
				userId: context.auth.user.id,
				zedToken: readRevision(context, input),
				setup: input.setup,
			}),
		};
	});

/** Only setup editors see who the bot is shared with and whether they are covered. */
const setupCoverage = authed.botSetup.coverage
	.use(requireOrganization())
	.effect(function* ({ input, context }) {
		yield* requireBotSetupEditor({
			botId: input.botId,
			organizationId: context.auth.session.activeOrganizationId,
			userId: context.auth.user.id,
			zedToken: readRevision(context, input),
		});
		return {
			data: yield* botSetupCoverage({
				botId: input.botId,
				organizationId: context.auth.session.activeOrganizationId,
				modelId: input.modelId,
				viewer: {
					userId: context.auth.user.id,
					zedToken: readRevision(context, input),
				},
			}),
		};
	});

export const botSetupRouter = {
	find: findSetup,
	save: saveSetup,
	coverage: setupCoverage,
};
