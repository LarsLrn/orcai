import type { BotId } from "@orcai/core";
import { DB, dbSchema, ownerColumns } from "@orcai/db";
import type { Bot } from "@orcai/schema";
import { eq, getColumns } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { getEntityCapabilities } from "@/lib/authz/entity-capabilities";
import { deleteResourcesWithAuthorization } from "@/lib/authz/resource-lifecycle";
import { readRevision } from "@/lib/authz/zed-token";
import {
	favouriteOf,
	isFavourite,
	setBotFavourite,
} from "@/lib/bots/bot-favourites";
import { loadBotEditor, saveBotGraph } from "@/lib/bots/bot-graph";
import { listBotTiles } from "@/lib/bots/bot-list";
import * as AppErrors from "@/lib/effect/utils/errors";
import { libraryAccess } from "@/lib/library/library-access";
import { homeOrganizations } from "@/lib/library/tile-details";
import { authed } from "@/lib/orpc/implementation/authed";
import { requireOrganization } from "@/lib/orpc/middlewares/organization";
import {
	type CheckManyPermissionInputFor,
	checkManyPermissionMiddleware,
	requireEntityPermission,
	requirePermission,
	requireReadableEntity,
} from "@/lib/orpc/middlewares/permission";

const listBots = authed.bot.list.use(requireOrganization()).effect(function* ({
	input,
	context,
}) {
	const reader = {
		userId: context.auth.user.id,
		organizationId: context.auth.session.activeOrganizationId,
		zedToken: readRevision(context, input),
	};
	return yield* listBotTiles({
		input,
		reader,
		access: yield* libraryAccess(reader),
	});
});

const findBot = authed.bot.find
	.use(requireOrganization())
	.use(
		requireReadableEntity("bot", {
			entityId: "id",
		}),
	)
	.effect(function* ({ input, context }) {
		const db = yield* DB;

		const [bot] = yield* db
			.select({
				...getColumns(dbSchema.bot),
				isFavourite,
				owner: ownerColumns,
			})
			.from(dbSchema.bot)
			.innerJoin(dbSchema.user, eq(dbSchema.user.id, dbSchema.bot.userId))
			.leftJoin(dbSchema.botFavourite, favouriteOf(context.auth.user.id))
			.where(eq(dbSchema.bot.id, input.id));

		if (!bot) {
			return yield* Effect.fail(
				new AppErrors.NotFoundError({
					reason: "BOT_NOT_FOUND",
					message: "Bot not found",
				}),
			);
		}

		const blockIds = yield* db
			.select({
				...getColumns(dbSchema.botBlock),
			})
			.from(dbSchema.botBlock)
			.where(eq(dbSchema.botBlock.botId, bot.id));
		const [capabilities, homes] = yield* Effect.all(
			[
				getEntityCapabilities({
					entityType: "bot",
					entityId: bot.id,
					userId: context.auth.user.id,
					organizationId: context.auth.session.activeOrganizationId,
					zedToken: readRevision(context, input),
				}),
				homeOrganizations(
					"bot",
					[
						bot.id,
					],
					context.auth.session.activeOrganizationId,
				),
			],
			{
				concurrency: "unbounded",
			},
		);

		return {
			data: {
				...bot,
				contentJson: bot.contentJson as Bot["contentJson"],
				blockIds: blockIds.map((b) => b.blockId),
				capabilities,
				homeOrganization: homes(bot.id),
			},
		};
	});

const findBotEditor = authed.bot.findEditor
	.use(requireOrganization())
	.use(
		requireEntityPermission("bot", "edit", {
			entityId: "id",
		}),
	)
	.effect(function* ({ input, context }) {
		return yield* loadBotEditor({
			id: input.id,
			userId: context.auth.user.id,
			organizationId: context.auth.session.activeOrganizationId,
			zedToken: readRevision(context, input),
		});
	});

const saveBot = authed.bot.save
	.use(
		requireOrganization((input: { id?: BotId | undefined }) =>
			input.id ? "read" : "create_bot",
		),
	)
	.effect(function* ({ input, context }) {
		const resolvedZedToken = readRevision(context, input);

		if (input.id) {
			yield* requirePermission({
				entityId: input.id,
				entityType: "bot",
				permission: "edit",
				userId: context.auth.user.id,
				zedToken: resolvedZedToken,
			});
		}

		return yield* saveBotGraph({
			input,
			userId: context.auth.user.id,
			organizationId: context.auth.session.activeOrganizationId,
			zedToken: resolvedZedToken,
		});
	});

const publishBot = authed.bot.publish
	.use(requireOrganization())
	.use(
		requireEntityPermission("bot", "edit", {
			entityId: "id",
		}),
	)
	.effect(function* ({ input, context }) {
		const db = yield* DB;
		const editor = yield* loadBotEditor({
			id: input.id,
			userId: context.auth.user.id,
			organizationId: context.auth.session.activeOrganizationId,
		});

		if (!editor.data.behaviour) {
			return yield* Effect.fail(
				new AppErrors.BadRequestError({
					reason: "BOT_BEHAVIOUR_BLOCK_REQUIRED",
					message: "Bots need a behaviour before they can be published.",
				}),
			);
		}

		if (editor.data.behaviour.status !== "ready") {
			return yield* Effect.fail(
				new AppErrors.BadRequestError({
					reason: "BOT_BEHAVIOUR_BLOCK_NOT_READY",
					message: "Publish the bot's behaviour before publishing this bot.",
				}),
			);
		}

		for (const repository of editor.data.repositories) {
			if (repository.status !== "ready") {
				return yield* Effect.fail(
					new AppErrors.BadRequestError({
						reason: "BOT_REPOSITORY_NOT_READY",
						params: {
							blockName: repository.name,
						},
						message: `Set "${repository.name}" to "ready" before publishing this bot.`,
					}),
				);
			}

			if (repository.assetIds.length === 0) {
				return yield* Effect.fail(
					new AppErrors.BadRequestError({
						reason: "BOT_REPOSITORY_EMPTY",
						params: {
							blockName: repository.name,
						},
						message: `Attach at least one asset to "${repository.name}" before publishing.`,
					}),
				);
			}
		}

		yield* db
			.update(dbSchema.bot)
			.set({
				status: "ready",
				updatedAt: new Date(),
			})
			.where(eq(dbSchema.bot.id, input.id));
		const updatedEditor = yield* loadBotEditor({
			id: input.id,
			userId: context.auth.user.id,
			organizationId: context.auth.session.activeOrganizationId,
		});

		return {
			data: {
				...updatedEditor.data,
				status: "ready" as const,
			},
		};
	});

const setFavourite = authed.bot.setFavourite
	.use(
		requireReadableEntity("bot", {
			entityId: "id",
		}),
	)
	.effect(function* ({ input, context }) {
		return yield* setBotFavourite({
			botId: input.id,
			userId: context.auth.user.id,
			favourite: input.favourite,
		});
	});

const deleteBots = authed.bot.delete
	.use(
		checkManyPermissionMiddleware("bot").adaptInput(
			(input): CheckManyPermissionInputFor<"bot"> => ({
				entityIds: input.refs.map((ref) => ref.id),
				permission: "delete",
			}),
		),
	)
	.effect(function* ({ context }) {
		yield* deleteResourcesWithAuthorization({
			resourceType: "bot",
			resourceIds: context.allowedIds,
		});

		return {
			success: true,
			message: "Bots deleted successfully",
		};
	});

export const botRouter = {
	list: listBots,
	find: findBot,
	findEditor: findBotEditor,
	save: saveBot,
	publish: publishBot,
	setFavourite,
	delete: deleteBots,
};
