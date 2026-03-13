import { and, count, eq, getColumns, ilike, inArray } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { dbSchema } from "@/db/schema";
import { calculateRelationDelta } from "@/lib/authz/relation-delta";
import { initializeResourceAuthorization } from "@/lib/authz/resource-lifecycle";
import { AuthzService } from "@/lib/effect/services/authz";
import { DB } from "@/lib/effect/services/drizzle";
import { NotFoundError } from "@/lib/effect/utils/errors";
import { runOrpcEffect } from "@/lib/effect/utils/orpc-helpers";
import { authed } from "@/lib/orpc/implementation/authed";
import { requireActiveOrganizationMiddleware } from "@/lib/orpc/middlewares/auth";
import {
	type CheckManyPermissionInput,
	type CheckPermissionInput,
	checkManyPermissionMiddleware,
	checkPermissionMiddleware,
} from "@/lib/orpc/middlewares/permission";
import {
	loadDatabaseBlockAssets,
	syncDatabaseBlockAssets,
} from "@/lib/orpc/router/helpers/database-block";
import type { Block } from "@/lib/orpc/schemas/block";
import type { Bot } from "@/lib/orpc/schemas/bot";
import type { BotEditorSave } from "@/lib/orpc/schemas/bot-editor";
import type { PublicationStatus } from "@/lib/orpc/schemas/fragments/publication-status";
import {
	checkEntityPermission,
	hasPermission,
	lookupEntitiesByPermission,
} from "@/lib/spice-db/client";

const listBotsByStatus = (params: {
	userId: string;
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
			Effect.map(([data, [countResult]]) => ({
				data,
				rowCount: countResult.count,
			})),
		);
	});

const loadBotEditor = (params: { id: string }) =>
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

		const databaseBlocksWithAssets = yield* Effect.forEach(
			databaseBlocks,
			(block) =>
				Effect.gen(function* () {
					const assets = yield* loadDatabaseBlockAssets({
						blockId: block.id,
					});

					return {
						...block,
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
						}
					: null,
				databaseBlocks: databaseBlocksWithAssets,
			},
		};
	});

// Creates a new block and initializes its authorization relationships.
const createBlock = (params: {
	name: string;
	type: "template" | "database";
	config: object;
	status: "draft" | "ready";
	userId: string;
	organizationId: string;
}) =>
	Effect.gen(function* () {
		const db = yield* DB;

		const [block] = yield* db
			.insert(dbSchema.block)
			.values({
				name: params.name,
				type: params.type,
				config: params.config,
				status: params.status,
				userId: params.userId,
				createdAt: new Date(),
				updatedAt: new Date(),
			})
			.returning({
				...getColumns(dbSchema.block),
			})
			.pipe(Effect.map((rows) => rows as Block[]));

		const relationResult = yield* initializeResourceAuthorization({
			resourceType: "block",
			resourceId: block.id,
			organizationId: params.organizationId,
			ownerUserId: params.userId,
		});

		return {
			block,
			zedToken: relationResult.zedToken,
		};
	});

// Updates an existing block or creates a new one, returning its resolved ID.
const upsertBotBlock = (params: {
	block: {
		id?: string;
		name: string;
		config: object;
	};
	type: "template" | "database";
	currentStatus: "draft" | "ready";
	userId: string;
	organizationId: string;
}) =>
	Effect.gen(function* () {
		const db = yield* DB;

		if (params.block.id) {
			yield* db
				.update(dbSchema.block)
				.set({
					name: params.block.name,
					config: params.block.config,
					status: params.currentStatus,
					updatedAt: new Date(),
				})
				.where(eq(dbSchema.block.id, params.block.id));
			return {
				blockId: params.block.id,
				zedToken: undefined as string | undefined,
			};
		}

		const { block, zedToken } = yield* createBlock({
			name: params.block.name,
			type: params.type,
			config: params.block.config,
			status: params.currentStatus,
			userId: params.userId,
			organizationId: params.organizationId,
		});

		return {
			blockId: block.id,
			zedToken,
		};
	});

// Resolves the bot record: updates if it exists, inserts if new.
const resolveBot = (params: {
	input: BotEditorSave;
	userId: string;
	organizationId: string;
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
	input: BotEditorSave;
	userId: string;
	organizationId: string;
}) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const authz = yield* AuthzService;

		const {
			botId,
			zedToken: resolvedZedToken,
			currentStatus,
		} = yield* resolveBot(params);
		let zedToken = resolvedZedToken;

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

		const existingById = new Map(
			existingBlocks.map((block) => [
				block.id,
				block,
			]),
		);
		const nextBlockIds: string[] = [];

		if (params.input.templateBlock) {
			const { blockId, zedToken: blockZedToken } = yield* upsertBotBlock({
				block: params.input.templateBlock,
				type: "template",
				currentStatus,
				userId: params.userId,
				organizationId: params.organizationId,
			});
			zedToken ??= blockZedToken;
			nextBlockIds.push(blockId);
		}

		for (const databaseBlock of params.input.databaseBlocks) {
			const { blockId, zedToken: blockZedToken } = yield* upsertBotBlock({
				block: databaseBlock,
				type: "database",
				currentStatus,
				userId: params.userId,
				organizationId: params.organizationId,
			});
			zedToken ??= blockZedToken;

			yield* syncDatabaseBlockAssets({
				blockId,
				assetIds: databaseBlock.assetIds,
			});

			nextBlockIds.push(blockId);
		}

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

		const removableDraftIds = removedIds.filter(
			(blockId) => existingById.get(blockId)?.status === "draft",
		);

		if (removableDraftIds.length > 0) {
			yield* db
				.delete(dbSchema.block)
				.where(inArray(dbSchema.block.id, removableDraftIds));
		}

		const editor = yield* loadBotEditor({
			id: botId,
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

export const listBots = authed.bot.list.handler(async ({ input, context }) =>
	runOrpcEffect(
		listBotsByStatus({
			userId: context.auth.user.id,
			status: "ready",
			pageIndex: input.pageIndex,
			pageSize: input.pageSize,
			search: input.search,
			zedToken: input.zedToken,
			permission: "read",
		}),
	),
);

export const listDraftBots = authed.bot.listDrafts.handler(
	async ({ input, context }) =>
		runOrpcEffect(
			listBotsByStatus({
				userId: context.auth.user.id,
				status: "draft",
				pageIndex: input.pageIndex,
				pageSize: input.pageSize,
				search: input.search,
				zedToken: input.zedToken,
				permission: "edit",
			}),
		),
);

export const findBot = authed.bot.find
	.use(
		checkPermissionMiddleware,
		(input) =>
			({
				entityId: input.id,
				permission: "read",
				entityType: "bot",
				zedToken: input.zedToken,
			}) satisfies CheckPermissionInput,
	)
	.handler(async ({ input, errors }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;

				const [bot] = yield* db
					.select({
						...getColumns(dbSchema.bot),
					})
					.from(dbSchema.bot)
					.where(eq(dbSchema.bot.id, input.id));

				if (!bot) {
					return yield* Effect.fail(
						errors.NOT_FOUND({
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

				return {
					data: {
						...bot,
						blockIds: blockIds.map((b) => b.blockId),
					},
				};
			}),
		),
	);

export const findBotEditor = authed.bot.findEditor
	.use(
		checkPermissionMiddleware,
		(input) =>
			({
				entityId: input.id,
				permission: "edit",
				entityType: "bot",
			}) satisfies CheckPermissionInput,
	)
	.handler(async ({ input, errors }) =>
		runOrpcEffect(
			loadBotEditor({
				id: input.id,
			}).pipe(
				Effect.mapError(() =>
					errors.NOT_FOUND({
						message: "Bot not found",
					}),
				),
			),
		),
	);

export const saveBot = authed.bot.save
	.use(requireActiveOrganizationMiddleware)
	.handler(async ({ input, context, errors }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				if (input.id) {
					const permission = yield* checkEntityPermission({
						entityId: input.id,
						entityType: "bot",
						permission: "edit",
						userId: context.auth.user.id,
						zedToken: undefined,
					});
					if (!hasPermission(permission)) {
						return yield* Effect.fail(
							errors.FORBIDDEN({
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
						zedToken: undefined,
					});
					if (!hasPermission(permission)) {
						return yield* Effect.fail(
							errors.FORBIDDEN({
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
				});
			}),
		),
	);

export const publishBot = authed.bot.publish
	.use(
		checkPermissionMiddleware,
		(input) =>
			({
				entityId: input.id,
				permission: "edit",
				entityType: "bot",
			}) satisfies CheckPermissionInput,
	)
	.handler(async ({ input, errors }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;
				const editor = yield* loadBotEditor({
					id: input.id,
				});

				if (!editor.data.templateBlock) {
					return yield* Effect.fail(
						errors.BAD_REQUEST({
							message:
								"Bots need a template block before they can be published.",
						}),
					);
				}

				if (!editor.data.templateBlock.config.provider) {
					return yield* Effect.fail(
						errors.BAD_REQUEST({
							message:
								"Select a provider for the template block before publishing.",
						}),
					);
				}

				if (!editor.data.templateBlock.config.model) {
					return yield* Effect.fail(
						errors.BAD_REQUEST({
							message:
								"Select a text model for the template block before publishing.",
						}),
					);
				}

				for (const databaseBlock of editor.data.databaseBlocks) {
					if (!databaseBlock.config.provider) {
						return yield* Effect.fail(
							errors.BAD_REQUEST({
								message: `Select a provider for "${databaseBlock.name}" before publishing.`,
							}),
						);
					}

					if (!databaseBlock.config.embeddingModel) {
						return yield* Effect.fail(
							errors.BAD_REQUEST({
								message: `Select an embedding model for "${databaseBlock.name}" before publishing.`,
							}),
						);
					}

					if (databaseBlock.assetIds.length === 0) {
						return yield* Effect.fail(
							errors.BAD_REQUEST({
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

				const blockIds = [
					editor.data.templateBlock.id,
					...editor.data.databaseBlocks.map(
						(databaseBlock) => databaseBlock.id,
					),
				];

				if (blockIds.length > 0) {
					yield* db
						.update(dbSchema.block)
						.set({
							status: "ready",
							updatedAt: new Date(),
						})
						.where(inArray(dbSchema.block.id, blockIds));
				}

				return {
					data: {
						...editor.data,
						status: "ready" as const,
						templateBlock: {
							...editor.data.templateBlock,
							status: "ready" as const,
						},
						databaseBlocks: editor.data.databaseBlocks.map((b) => ({
							...b,
							status: "ready" as const,
						})),
					},
				};
			}),
		),
	);

export const deleteBots = authed.bot.delete
	.use(
		checkManyPermissionMiddleware,
		(input) =>
			({
				entityIds: input.refs.map((ref) => ref.id),
				permission: "delete",
				entityType: "bot",
			}) satisfies CheckManyPermissionInput,
	)
	.handler(async ({ context }) =>
		runOrpcEffect(
			Effect.gen(function* () {
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
			}),
		),
	);
