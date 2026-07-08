import type { BotId, OrganizationId, UserId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import type {
	Block,
	Bot,
	PublicationStatus,
	SaveBotInput,
} from "@orcai/schema";
import {
	checkEntityPermission,
	checkManyEntityPermissions,
	hasPermission,
	lookupEntitiesByPermission,
} from "@orcai/spice-db";
import { and, count, eq, getColumns, ilike, inArray } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { emptyCapabilities } from "@/lib/authz/capabilities";
import { calculateRelationDelta } from "@/lib/authz/relation-delta";
import { initializeResourceAuthorization } from "@/lib/authz/resource-lifecycle";
import { AuthzService } from "@/lib/effect/services/authz";
import * as AppErrors from "@/lib/effect/utils/errors";
import { NotFoundError } from "@/lib/effect/utils/errors";
import { authed } from "@/lib/orpc/implementation/authed";
import { requireActiveOrganizationMiddleware } from "@/lib/orpc/middlewares/auth";
import {
	type CheckManyPermissionInputFor,
	checkManyPermissionMiddleware,
	requireEntityPermission,
} from "@/lib/orpc/middlewares/permission";
import {
	getEntityCapabilities,
	getManyEntityCapabilities,
} from "@/lib/orpc/router/helpers/capabilities";
import { loadDatabaseBlockAssets } from "@/lib/orpc/router/helpers/database-block";

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
		}).pipe(
			Effect.map((response) => response.map((item) => item.resourceObjectId)),
		);

		const whereConditions = [
			inArray(dbSchema.bot.id, allowedIds),
			eq(dbSchema.bot.status, params.status),
		];

		if (params.search) {
			whereConditions.push(ilike(dbSchema.bot.name, `%${params.search}%`));
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
				entity: "Bot",
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
					message: "Linked AI behaviour block must be a template block.",
				}),
			);
		}

		for (const databaseBlockId of databaseBlockIds) {
			if (blockById.get(databaseBlockId)?.type !== "database") {
				return yield* Effect.fail(
					new AppErrors.BadRequestError({
						message:
							"Linked content collection block must be a database block.",
					}),
				);
			}
		}

		const linkPermissions = yield* checkManyEntityPermissions({
			entityIds: nextBlockIds,
			entityType: "block",
			permission: "read",
			userId: params.userId,
			zedToken: params.zedToken,
		});

		const readableIds = new Set<string>();

		for (const pair of linkPermissions.pairs) {
			const blockId = pair.request?.resource?.objectId;
			const allowed =
				pair.response.oneofKind === "item" &&
				hasPermission({
					permissionship: pair.response.item.permissionship,
				});

			if (blockId && allowed) {
				readableIds.add(blockId);
			}
		}

		const unreadableIds = nextBlockIds.filter(
			(blockId) => !readableIds.has(blockId),
		);

		if (unreadableIds.length > 0) {
			return yield* Effect.fail(
				new AppErrors.ForbiddenError({
					message:
						"You do not have access to link one or more selected blocks.",
					data: {
						allowed: false,
					},
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
					updatedAt: new Date(),
				})
				.where(eq(dbSchema.bot.id, params.input.id));

			return {
				botId: params.input.id,
				zedToken: undefined as string | undefined,
				currentStatus,
			};
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
				userId: params.userId,
				createdAt: new Date(),
				updatedAt: new Date(),
			})
			.returning({
				...getColumns(dbSchema.bot),
			});

		const { zedToken } = yield* initializeResourceAuthorization({
			resourceType: "bot",
			resourceId: bot.id,
			organizationId: params.organizationId,
			ownerUserId: params.userId,
		});

		return {
			botId: bot.id,
			zedToken,
			currentStatus,
		};
	});

const saveBotGraph = (params: {
	input: SaveBotInput;
	userId: UserId;
	organizationId: OrganizationId;
	zedToken?: string;
}) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const authz = yield* AuthzService;

		const { botId, zedToken: resolvedZedToken } = yield* resolveBot(params);
		const zedToken = resolvedZedToken;

		const existingBlocks = yield* db
			.select({
				...getColumns(dbSchema.block),
			})
			.from(dbSchema.botBlock)
			.innerJoin(
				dbSchema.block,
				eq(dbSchema.block.id, dbSchema.botBlock.blockId),
			)
			.where(eq(dbSchema.botBlock.botId, botId))
			.pipe(Effect.map((rows) => rows as Block[]));

		const nextBlockIds = yield* resolveLinkedBlocksForSave({
			input: params.input,
			userId: params.userId,
			zedToken: params.zedToken,
		});

		const previousBlockIds = existingBlocks.map((block) => block.id);
		const { removedIds, addedIds } = calculateRelationDelta(
			previousBlockIds,
			nextBlockIds,
		);

		yield* db
			.delete(dbSchema.botBlock)
			.where(eq(dbSchema.botBlock.botId, botId));

		if (nextBlockIds.length > 0) {
			yield* db.insert(dbSchema.botBlock).values(
				nextBlockIds.map((blockId) => ({
					botId,
					blockId,
					createdAt: new Date(),
				})),
			);
		}

		if (removedIds.length > 0 || addedIds.length > 0) {
			yield* authz.applyRelationshipMutations({
				mutations: [
					...removedIds.map((blockId) => ({
						resourceType: "block" as const,
						resourceId: blockId,
						relation: "bot" as const,
						subjectType: "bot" as const,
						subjectId: botId,
						operation: "delete" as const,
					})),
					...addedIds.map((blockId) => ({
						resourceType: "block" as const,
						resourceId: blockId,
						relation: "bot" as const,
						subjectType: "bot" as const,
						subjectId: botId,
						operation: "touch" as const,
					})),
				],
			});
		}

		const editor = yield* loadBotEditor({
			id: botId,
			userId: params.userId,
			zedToken: zedToken ?? params.zedToken,
		});

		return {
			...editor,
			meta: zedToken
				? {
						zedToken,
					}
				: undefined,
		};
	});

export const listBots = authed.bot.list.effect(function* ({ input, context }) {
	return yield* listBotsByStatus({
		userId: context.auth.user.id,
		status: "ready",
		pageIndex: input.pageIndex,
		pageSize: input.pageSize,
		search: input.search,
		zedToken: input.zedToken,
		permission: "read",
	});
});

export const listDraftBots = authed.bot.listDrafts.effect(function* ({
	input,
	context,
}) {
	return yield* listBotsByStatus({
		userId: context.auth.user.id,
		status: "draft",
		pageIndex: input.pageIndex,
		pageSize: input.pageSize,
		search: input.search,
		zedToken: input.zedToken,
		permission: "edit",
	});
});

export const findBot = authed.bot.find
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
			zedToken: input.zedToken,
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

export const findBotEditor = authed.bot.findEditor
	.use(
		requireEntityPermission("bot", "edit", {
			entityId: "id",
		}),
	)
	.effect(function* ({ input, context }) {
		return yield* loadBotEditor({
			id: input.id,
			userId: context.auth.user.id,
			zedToken: input.zedToken ?? context.meta?.zedToken,
		}).pipe(
			Effect.mapError(
				() =>
					new AppErrors.NotFoundError({
						message: "Bot not found",
					}),
			),
		);
	});

export const saveBot = authed.bot.save
	.use(requireActiveOrganizationMiddleware)
	.effect(function* ({ input, context }) {
		const resolvedZedToken = input.zedToken ?? context.meta?.zedToken;

		if (input.id) {
			const permission = yield* checkEntityPermission({
				entityId: input.id,
				entityType: "bot",
				permission: "edit",
				userId: context.auth.user.id,
				zedToken: resolvedZedToken,
			});
			if (!hasPermission(permission)) {
				return yield* Effect.fail(
					new AppErrors.ForbiddenError({
						message: "You do not have permission to edit this bot.",
						data: {
							allowed: false,
						},
					}),
				);
			}
		} else {
			const permission = yield* checkEntityPermission({
				entityId: context.auth.session.activeOrganizationId,
				entityType: "organization",
				permission: "create_bot",
				userId: context.auth.user.id,
				zedToken: resolvedZedToken,
			});
			if (!hasPermission(permission)) {
				return yield* Effect.fail(
					new AppErrors.ForbiddenError({
						message: "You do not have permission to create bots.",
						data: {
							allowed: false,
						},
					}),
				);
			}
		}

		return yield* saveBotGraph({
			input,
			userId: context.auth.user.id,
			organizationId: context.auth.session.activeOrganizationId,
			zedToken: resolvedZedToken,
		});
	});

export const publishBot = authed.bot.publish
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
					message: "Bots need a template block before they can be published.",
				}),
			);
		}

		if (editor.data.templateBlock.status !== "ready") {
			return yield* Effect.fail(
				new AppErrors.BadRequestError({
					message:
						'Set the AI behaviour block to "ready" before publishing this bot.',
				}),
			);
		}

		for (const databaseBlock of editor.data.databaseBlocks) {
			if (databaseBlock.status !== "ready") {
				return yield* Effect.fail(
					new AppErrors.BadRequestError({
						message: `Set "${databaseBlock.name}" to "ready" before publishing this bot.`,
					}),
				);
			}

			if (databaseBlock.assetIds.length === 0) {
				return yield* Effect.fail(
					new AppErrors.BadRequestError({
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

export const deleteBots = authed.bot.delete
	.use(
		checkManyPermissionMiddleware("bot").adaptInput(
			(input): CheckManyPermissionInputFor<"bot"> => ({
				entityIds: input.refs.map((ref) => ref.id),
				permission: "delete",
			}),
		),
	)
	.effect(function* ({ context }) {
		const db = yield* DB;

		if (!context.allowedIds || context.allowedIds.length === 0) {
			return {
				success: true,
				message: "No bots to delete",
			};
		}

		yield* db
			.delete(dbSchema.bot)
			.where(inArray(dbSchema.bot.id, context.allowedIds));

		return {
			success: true,
			message: "Bots deleted successfully",
		};
	});
