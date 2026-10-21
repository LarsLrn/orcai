import type { BotId, OrganizationId, UserId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import type {
	Block,
	Bot,
	PublicationStatus,
	SaveBotInput,
} from "@orcai/schema";
import {
	lookupEntitiesByPermission,
	permittedEntityIds,
} from "@orcai/spice-db";
import { and, count, eq, getColumns, ilike, inArray } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { checkFeatureRequirements } from "@/lib/ai/features/requirements";
import { emptyCapabilities } from "@/lib/authz/capabilities";
import { RelationshipFact } from "@/lib/authz/relationship-facts";
import {
	recordRelationshipFacts,
	writeRelationships,
} from "@/lib/authz/relationship-write";
import {
	deleteResourcesWithAuthorization,
	initializeResourceAuthorization,
	resourceOrganizations,
} from "@/lib/authz/resource-lifecycle";
import { getZedToken } from "@/lib/authz/zed-token";
import * as AppErrors from "@/lib/effect/utils/errors";
import { NotFoundError } from "@/lib/effect/utils/errors";
import { authed } from "@/lib/orpc/implementation/authed";
import { requireActiveOrganizationMiddleware } from "@/lib/orpc/middlewares/auth";
import {
	type CheckManyPermissionInputFor,
	checkManyPermissionMiddleware,
	requireEntityPermission,
	requirePermission,
} from "@/lib/orpc/middlewares/permission";
import {
	getEntityCapabilities,
	getManyEntityCapabilities,
} from "@/lib/orpc/router/helpers/capabilities";
import { loadDatabaseBlockAssets } from "@/lib/orpc/router/helpers/database-block";
import { literalSearch } from "./helpers/literal-search";

const listBotsByStatus = (params: {
	userId: UserId;
	status: PublicationStatus;
	pageIndex: number;
	pageSize: number;
	search?: string;
	zedToken?: string;
	permission: "read" | "edit";
}) =>
	Effect.gen(function* () {
		const db = yield* DB;

		const allowedIds = yield* lookupEntitiesByPermission({
			userId: params.userId,
			permission: params.permission,
			entityType: "bot",
			zedToken: params.zedToken,
		});

		const whereConditions = [
			inArray(dbSchema.bot.id, allowedIds),
			eq(dbSchema.bot.status, params.status),
		];

		if (params.search) {
			whereConditions.push(
				ilike(dbSchema.bot.name, literalSearch(params.search)),
			);
		}

		return yield* Effect.all(
			[
				db
					.select({
						...getColumns(dbSchema.bot),
					})
					.from(dbSchema.bot)
					.where(and(...whereConditions))
					.limit(params.pageSize)
					.offset(params.pageIndex * params.pageSize),
				db
					.select({
						count: count(),
					})
					.from(dbSchema.bot)
					.where(and(...whereConditions)),
			],
			{
				concurrency: "unbounded",
			},
		).pipe(
			Effect.flatMap(([data, [countResult]]) =>
				Effect.gen(function* () {
					const capabilities = yield* getManyEntityCapabilities({
						entityType: "bot",
						entityIds: data.map((bot) => bot.id),
						userId: params.userId,
						zedToken: params.zedToken,
					});

					return {
						data: data.map((bot) => ({
							...bot,
							contentJson: bot.contentJson as Bot["contentJson"],
							capabilities:
								capabilities.get(bot.id) ?? emptyCapabilities("bot"),
						})),
						rowCount: countResult.count,
					};
				}),
			),
		);
	});

const loadBotEditor = (params: {
	id: BotId;
	userId: UserId;
	zedToken?: string;
}) =>
	Effect.gen(function* () {
		const db = yield* DB;

		const [bot] = yield* db
			.select({
				...getColumns(dbSchema.bot),
			})
			.from(dbSchema.bot)
			.where(eq(dbSchema.bot.id, params.id));

		if (!bot) {
			return yield* new NotFoundError({
				reason: "BOT_NOT_FOUND",
				id: params.id,
			});
		}

		const blocks = yield* db
			.select({
				...getColumns(dbSchema.block),
			})
			.from(dbSchema.botBlock)
			.innerJoin(
				dbSchema.block,
				eq(dbSchema.block.id, dbSchema.botBlock.blockId),
			)
			.where(eq(dbSchema.botBlock.botId, params.id))
			.pipe(Effect.map((rows) => rows as Block[]));

		const templateBlock = blocks.find((block) => block.type === "template");
		const databaseBlocks = blocks.filter((block) => block.type === "database");
		const blockCapabilities = yield* getManyEntityCapabilities({
			entityType: "block",
			entityIds: blocks.map((block) => block.id),
			userId: params.userId,
			zedToken: params.zedToken,
		});
		const botCapabilities = yield* getEntityCapabilities({
			entityType: "bot",
			entityId: params.id,
			userId: params.userId,
			zedToken: params.zedToken,
		});

		const databaseBlocksWithAssets = yield* Effect.forEach(
			databaseBlocks,
			(block) =>
				Effect.gen(function* () {
					const assets = yield* loadDatabaseBlockAssets({
						blockId: block.id,
						userId: params.userId,
						zedToken: params.zedToken,
					});

					return {
						...block,
						capabilities:
							blockCapabilities.get(block.id) ?? emptyCapabilities("block"),
						assetIds: assets.map((asset) => asset.id),
						assets,
					};
				}),
			{
				concurrency: "unbounded",
			},
		);

		return {
			data: {
				id: bot.id,
				name: bot.name,
				description: bot.description,
				contentJson: bot.contentJson as Bot["contentJson"],
				contentHtml: bot.contentHtml,
				status: bot.status,
				templateBlock: templateBlock
					? {
							...templateBlock,
							type: "template" as const,
							capabilities:
								blockCapabilities.get(templateBlock.id) ??
								emptyCapabilities("block"),
						}
					: null,
				databaseBlocks: databaseBlocksWithAssets,
				features: bot.features,
				capabilities: botCapabilities,
			},
		};
	});

const resolveLinkedBlocksForSave = (params: {
	input: SaveBotInput;
	userId: UserId;
	zedToken?: string;
}) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const templateBlockId = params.input.templateBlockId;
		const databaseBlockIds = Array.from(new Set(params.input.databaseBlockIds));
		const nextBlockIds = [
			...(templateBlockId
				? [
						templateBlockId,
					]
				: []),
			...databaseBlockIds,
		];

		if (nextBlockIds.length === 0) {
			return [];
		}

		const linkedBlocks = yield* db
			.select({
				...getColumns(dbSchema.block),
			})
			.from(dbSchema.block)
			.where(inArray(dbSchema.block.id, nextBlockIds))
			.pipe(Effect.map((rows) => rows as Block[]));

		if (linkedBlocks.length !== nextBlockIds.length) {
			return yield* Effect.fail(
				new AppErrors.BadRequestError({
					reason: "BLOCK_NOT_FOUND",
					message: "One or more linked blocks could not be found.",
				}),
			);
		}

		const blockById = new Map(
			linkedBlocks.map((block) => [
				block.id,
				block,
			]),
		);

		if (
			templateBlockId &&
			blockById.get(templateBlockId)?.type !== "template"
		) {
			return yield* Effect.fail(
				new AppErrors.BadRequestError({
					reason: "BEHAVIOUR_BLOCK_TYPE_INVALID",
					message: "Linked AI behaviour block must be a template block.",
				}),
			);
		}

		for (const databaseBlockId of databaseBlockIds) {
			if (blockById.get(databaseBlockId)?.type !== "database") {
				return yield* Effect.fail(
					new AppErrors.BadRequestError({
						reason: "REPOSITORY_BLOCK_TYPE_INVALID",
						message:
							"Linked content collection block must be a database block.",
					}),
				);
			}
		}

		const readableIds = yield* permittedEntityIds({
			entityIds: nextBlockIds,
			entityType: "block",
			permission: "read",
			userId: params.userId,
			zedToken: params.zedToken,
		});

		const unreadableIds = nextBlockIds.filter(
			(blockId) => !readableIds.has(blockId),
		);

		if (unreadableIds.length > 0) {
			return yield* Effect.fail(
				new AppErrors.ForbiddenError({
					reason: "BLOCK_LINK_FORBIDDEN",
					message:
						"You do not have access to link one or more selected blocks.",
				}),
			);
		}

		return nextBlockIds;
	});

// Resolves the bot record: updates if it exists, inserts if new.
const resolveBot = (params: {
	input: SaveBotInput;
	userId: UserId;
	organizationId: OrganizationId;
}) =>
	Effect.gen(function* () {
		const db = yield* DB;

		if (params.input.id) {
			const [existingBot] = yield* db
				.select({
					...getColumns(dbSchema.bot),
				})
				.from(dbSchema.bot)
				.where(eq(dbSchema.bot.id, params.input.id));

			const currentStatus = (params.input.status ??
				existingBot?.status ??
				"draft") as "draft" | "ready";

			yield* db
				.update(dbSchema.bot)
				.set({
					name: params.input.name,
					description: params.input.description,
					contentJson: params.input.contentJson,
					contentHtml: params.input.contentHtml,
					status: currentStatus,
					features: params.input.features,
					updatedAt: new Date(),
				})
				.where(eq(dbSchema.bot.id, params.input.id));

			return params.input.id;
		}

		const currentStatus =
			(params.input.status as "draft" | "ready" | undefined) ?? "draft";

		const [bot] = yield* db
			.insert(dbSchema.bot)
			.values({
				name: params.input.name,
				description: params.input.description,
				contentJson: params.input.contentJson,
				contentHtml: params.input.contentHtml,
				status: currentStatus,
				features: params.input.features,
				userId: params.userId,
				createdAt: new Date(),
				updatedAt: new Date(),
			})
			.returning({
				...getColumns(dbSchema.bot),
			});

		yield* initializeResourceAuthorization({
			resource: {
				resourceType: "bot",
				resourceId: bot.id,
			},
			organizationId: params.organizationId,
			ownerUserId: params.userId,
		});

		return bot.id;
	});

const saveBotGraph = (params: {
	input: SaveBotInput;
	userId: UserId;
	organizationId: OrganizationId;
	zedToken?: string;
}) =>
	Effect.gen(function* () {
		const db = yield* DB;

		const nextBlockIds = yield* resolveLinkedBlocksForSave({
			input: params.input,
			userId: params.userId,
			zedToken: params.zedToken,
		});

		const organizationIds = params.input.id
			? yield* resourceOrganizations([
					{
						resourceType: "bot",
						resourceId: params.input.id,
					},
				])
			: [
					params.organizationId,
				];

		const { result: botId, zedToken } = yield* writeRelationships(
			{
				organizationIds,
			},
			Effect.gen(function* () {
				const botId = yield* resolveBot(params);

				const previousBlockIds = (yield* db
					.delete(dbSchema.botBlock)
					.where(eq(dbSchema.botBlock.botId, botId))
					.returning({
						blockId: dbSchema.botBlock.blockId,
					})).map((link) => link.blockId);

				if (nextBlockIds.length > 0) {
					yield* db.insert(dbSchema.botBlock).values(
						nextBlockIds.map((blockId) => ({
							botId,
							blockId,
							createdAt: new Date(),
						})),
					);
				}

				yield* recordRelationshipFacts(
					RelationshipFact.BotBlocksChanged({
						botId,
						before: previousBlockIds,
						after: nextBlockIds,
					}),
				);

				return botId;
			}),
		);

		return yield* loadBotEditor({
			id: botId,
			userId: params.userId,
			zedToken: zedToken ?? params.zedToken,
		});
	});

const listBots = authed.bot.list.effect(function* ({ input, context }) {
	return yield* listBotsByStatus({
		userId: context.auth.user.id,
		status: "ready",
		pageIndex: input.pageIndex,
		pageSize: input.pageSize,
		search: input.search,
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

		const [bot] = yield* db
			.select({
				...getColumns(dbSchema.bot),
			})
			.from(dbSchema.bot)
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
		});

		return {
			data: {
				...updatedEditor.data,
				status: "ready" as const,
			},
		};
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
	delete: deleteBots,
};
