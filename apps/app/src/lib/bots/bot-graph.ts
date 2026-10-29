import type { BlockId, BotId, OrganizationId, UserId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import type { Block, Bot, SaveBotInput } from "@orcai/schema";
import { and, eq, getColumns, inArray, isNull } from "drizzle-orm";
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import { emptyCapabilities } from "@/lib/authz/capabilities";
import {
	getEntityCapabilities,
	getManyEntityCapabilities,
} from "@/lib/authz/entity-capabilities";
import { usableInOrganization } from "@/lib/authz/organization-use";
import { RelationshipFact } from "@/lib/authz/relationship-facts";
import {
	recordRelationshipFacts,
	writeRelationships,
} from "@/lib/authz/relationship-write";
import {
	initializeResourceAuthorization,
	resourceOrganizations,
} from "@/lib/authz/resource-lifecycle";
import { loadDatabaseBlockAssets } from "@/lib/blocks/database-block";
import { isListed, listBlocksOfListedBot } from "@/lib/catalogue/listing";
import * as AppErrors from "@/lib/effect/utils/errors";

export const loadBotEditor = (params: {
	id: BotId;
	userId: UserId;
	organizationId: OrganizationId | undefined;
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
			return yield* new AppErrors.NotFoundError({
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
			organizationId: params.organizationId,
			zedToken: params.zedToken,
		});
		const botCapabilities = yield* getEntityCapabilities({
			entityType: "bot",
			entityId: params.id,
			userId: params.userId,
			organizationId: params.organizationId,
			zedToken: params.zedToken,
		});

		const databaseBlocksWithAssets = yield* Effect.forEach(
			databaseBlocks,
			(block) =>
				Effect.gen(function* () {
					const assets = yield* loadDatabaseBlockAssets({
						blockId: block.id,
						userId: params.userId,
						organizationId: params.organizationId,
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

const resolveLinkedBlocksForSave = (params: { input: SaveBotInput }) =>
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

		return nextBlockIds;
	});

/** The organisation a bot is home to, read under its lock. */
const homeOrganization = (botId: BotId) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const [scope] = yield* db
			.select({
				organizationId: dbSchema.resourceScope.organizationId,
			})
			.from(dbSchema.resourceScope)
			.where(
				and(
					eq(dbSchema.resourceScope.resourceType, "bot"),
					eq(dbSchema.resourceScope.resourceId, botId),
					eq(dbSchema.resourceScope.isPrimary, true),
					isNull(dbSchema.resourceScope.endedAt),
				),
			);
		if (!scope)
			return yield* new AppErrors.BadRequestError({
				reason: "RESOURCE_SCOPE_REQUIRED",
				message: "The bot has no home organisation.",
			});
		return scope.organizationId;
	});

/**
 * Fails unless the bot may link the blocks: each is scoped to the bot's home
 * organisation, and the editor may use there each one the bot did not link
 * yet. Call it under the home organisation's lock.
 */
const requireLinkableBlocks = (params: {
	blockIds: readonly BlockId[];
	previousBlockIds: readonly BlockId[];
	organizationId: OrganizationId;
	userId: UserId;
	zedToken?: string;
}) =>
	Effect.gen(function* () {
		if (params.blockIds.length === 0) return;
		const db = yield* DB;
		const scoped = yield* db
			.select({
				resourceId: dbSchema.resourceScope.resourceId,
			})
			.from(dbSchema.resourceScope)
			.where(
				and(
					eq(dbSchema.resourceScope.resourceType, "block"),
					inArray(dbSchema.resourceScope.resourceId, [
						...params.blockIds,
					]),
					eq(dbSchema.resourceScope.organizationId, params.organizationId),
					isNull(dbSchema.resourceScope.endedAt),
				),
			);
		const scopedIds = new Set(scoped.map((row) => row.resourceId));
		const addedIds = Arr.difference(params.blockIds, params.previousBlockIds);
		const usableIds = yield* usableInOrganization({
			resourceType: "block",
			resourceIds: addedIds,
			userId: params.userId,
			organizationId: params.organizationId,
			zedToken: params.zedToken,
		});

		if (
			params.blockIds.some((blockId) => !scopedIds.has(blockId)) ||
			addedIds.some((blockId) => !usableIds.has(blockId))
		) {
			return yield* new AppErrors.ForbiddenError({
				reason: "BLOCK_LINK_FORBIDDEN",
				message:
					"You do not have access to link one or more selected blocks in this bot's organisation.",
			});
		}
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

export const saveBotGraph = (params: {
	input: SaveBotInput;
	userId: UserId;
	organizationId: OrganizationId;
	zedToken?: string;
}) =>
	Effect.gen(function* () {
		const db = yield* DB;

		const nextBlockIds = yield* resolveLinkedBlocksForSave({
			input: params.input,
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
				yield* requireLinkableBlocks({
					blockIds: nextBlockIds,
					previousBlockIds,
					organizationId: params.input.id
						? yield* homeOrganization(botId)
						: params.organizationId,
					userId: params.userId,
					zedToken: params.zedToken,
				});
				if (
					yield* isListed({
						resourceType: "bot",
						resourceId: botId,
					})
				)
					yield* listBlocksOfListedBot({
						blockIds: Arr.difference(nextBlockIds, previousBlockIds),
						confirmedIds: params.input.listBlockIds,
						actor: {
							userId: params.userId,
							zedToken: params.zedToken,
						},
					});

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
			organizationId: params.organizationId,
			zedToken: zedToken ?? params.zedToken,
		});
	});
