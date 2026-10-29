import { DB, dbSchema } from "@orcai/db";
import type { Bot } from "@orcai/schema";
import { eq, getColumns } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { checkFeatureRequirements } from "@/lib/ai/features/requirements";
import { requireReadable } from "@/lib/authz/content-access";
import { getEntityCapabilities } from "@/lib/authz/entity-capabilities";
import { deleteResourcesWithAuthorization } from "@/lib/authz/resource-lifecycle";
import { getZedToken } from "@/lib/authz/zed-token";
import {
	favouriteOf,
	isFavourite,
	setBotFavourite,
} from "@/lib/bots/bot-favourites";
import {
	listBotsByStatus,
	loadBotEditor,
	saveBotGraph,
} from "@/lib/bots/bot-graph";
import * as AppErrors from "@/lib/effect/utils/errors";
import { authed } from "@/lib/orpc/implementation/authed";
import { requireActiveOrganizationMiddleware } from "@/lib/orpc/middlewares/auth";
import {
	type CheckManyPermissionInputFor,
	checkManyPermissionMiddleware,
	requireEntityPermission,
	requirePermission,
} from "@/lib/orpc/middlewares/permission";
import { ownerColumns } from "@/lib/orpc/router/helpers/resource-owner";

const listBots = authed.bot.list.effect(function* ({ input, context }) {
	return yield* listBotsByStatus({
		userId: context.auth.user.id,
		organizationId: context.auth.session.activeOrganizationId,
		status: "ready",
		pageIndex: input.pageIndex,
		pageSize: input.pageSize,
		search: input.search,
		favourite: input.filters?.favourite,
		sort: input.sort,
		zedToken: getZedToken(context, input),
		permission: "read",
	});
});

const listDraftBots = authed.bot.listDrafts.effect(function* ({
	input,
	context,
}) {
	return yield* listBotsByStatus({
		userId: context.auth.user.id,
		organizationId: context.auth.session.activeOrganizationId,
		status: "draft",
		pageIndex: input.pageIndex,
		pageSize: input.pageSize,
		search: input.search,
		zedToken: getZedToken(context, input),
		permission: "edit",
	});
});

const findBot = authed.bot.find
	.use(
		requireEntityPermission("bot", "read", {
			entityId: "id",
			zedToken: "zedToken",
		}),
	)
	.effect(function* ({ input, context }) {
		const db = yield* DB;
		yield* requireReadable("bot", input.id, {
			userId: context.auth.user.id,
			zedToken: getZedToken(context, input),
		});

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
		const capabilities = yield* getEntityCapabilities({
			entityType: "bot",
			entityId: bot.id,
			userId: context.auth.user.id,
			organizationId: context.auth.session.activeOrganizationId,
			zedToken: getZedToken(context, input),
		});

		return {
			data: {
				...bot,
				contentJson: bot.contentJson as Bot["contentJson"],
				blockIds: blockIds.map((b) => b.blockId),
				capabilities,
			},
		};
	});

const findBotEditor = authed.bot.findEditor
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
			zedToken: getZedToken(context, input),
		}).pipe(
			Effect.mapError(
				() =>
					new AppErrors.NotFoundError({
						reason: "BOT_NOT_FOUND",
						message: "Bot not found",
					}),
			),
		);
	});

const saveBot = authed.bot.save
	.use(requireActiveOrganizationMiddleware)
	.effect(function* ({ input, context }) {
		const resolvedZedToken = getZedToken(context, input);

		if (input.id) {
			yield* requirePermission({
				entityId: input.id,
				entityType: "bot",
				permission: "edit",
				userId: context.auth.user.id,
				zedToken: resolvedZedToken,
			});
		} else {
			yield* requirePermission({
				entityId: context.auth.session.activeOrganizationId,
				entityType: "organization",
				permission: "create_bot",
				userId: context.auth.user.id,
				zedToken: resolvedZedToken,
			});
		}

		yield* checkFeatureRequirements(input.features);

		return yield* saveBotGraph({
			input,
			userId: context.auth.user.id,
			organizationId: context.auth.session.activeOrganizationId,
			zedToken: resolvedZedToken,
		});
	});

const publishBot = authed.bot.publish
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

		if (!editor.data.templateBlock) {
			return yield* Effect.fail(
				new AppErrors.BadRequestError({
					reason: "BOT_BEHAVIOUR_BLOCK_REQUIRED",
					message: "Bots need a template block before they can be published.",
				}),
			);
		}

		if (editor.data.templateBlock.status !== "ready") {
			return yield* Effect.fail(
				new AppErrors.BadRequestError({
					reason: "BOT_BEHAVIOUR_BLOCK_NOT_READY",
					message:
						'Set the AI behaviour block to "ready" before publishing this bot.',
				}),
			);
		}

		yield* checkFeatureRequirements(editor.data.features);

		for (const databaseBlock of editor.data.databaseBlocks) {
			if (databaseBlock.status !== "ready") {
				return yield* Effect.fail(
					new AppErrors.BadRequestError({
						reason: "BOT_REPOSITORY_NOT_READY",
						params: {
							blockName: databaseBlock.name,
						},
						message: `Set "${databaseBlock.name}" to "ready" before publishing this bot.`,
					}),
				);
			}

			if (databaseBlock.assetIds.length === 0) {
				return yield* Effect.fail(
					new AppErrors.BadRequestError({
						reason: "BOT_REPOSITORY_EMPTY",
						params: {
							blockName: databaseBlock.name,
						},
						message: `Attach at least one document to "${databaseBlock.name}" before publishing.`,
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
		requireEntityPermission("bot", "read", {
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
		const allowedIds = context.allowedIds ?? [];

		if (allowedIds.length === 0) {
			return {
				success: true,
				message: "No bots to delete",
			};
		}

		yield* deleteResourcesWithAuthorization({
			resourceType: "bot",
			resourceIds: allowedIds,
		});

		return {
			success: true,
			message: "Bots deleted successfully",
		};
	});

export const botRouter = {
	list: listBots,
	listDrafts: listDraftBots,
	find: findBot,
	findEditor: findBotEditor,
	save: saveBot,
	publish: publishBot,
	setFavourite,
	delete: deleteBots,
};
