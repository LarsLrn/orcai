import type { BlockId, BotId, OrganizationId, UserId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import type { ResourceVisibility } from "@orcai/schema";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import * as Effect from "effect/Effect";
import { managedIds } from "@/lib/authz/content-access";
import {
	RelationshipFact,
	type ResourceRef,
} from "@/lib/authz/relationship-facts";
import {
	recordRelationshipFacts,
	writeRelationships,
} from "@/lib/authz/relationship-write";
import {
	lockExistingResource,
	resourceOrganizations,
} from "@/lib/authz/resource-lifecycle";
import { blocksToList } from "@/lib/catalogue/exposure";
import { endInstalls, installingOrganizations } from "@/lib/catalogue/installs";
import * as AppErrors from "@/lib/effect/utils/errors";

type Actor = {
	userId: UserId;
	zedToken: string | undefined;
};

const blockVisibility = and(
	eq(dbSchema.resourceVisibility.resourceType, "block"),
	eq(dbSchema.resourceVisibility.resourceId, dbSchema.block.id),
);

/** Whether the resource is listed in the catalogue. */
export const isListed = (resource: ResourceRef) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const [row] = yield* db
			.select({
				visibility: dbSchema.resourceVisibility.visibility,
			})
			.from(dbSchema.resourceVisibility)
			.where(
				and(
					eq(dbSchema.resourceVisibility.resourceType, resource.resourceType),
					eq(dbSchema.resourceVisibility.resourceId, resource.resourceId),
				),
			);
		return row?.visibility === "public";
	});

/** The blocks the bot links. */
export const linkedBlockIds = (botId: BotId) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const links = yield* db
			.select({
				blockId: dbSchema.botBlock.blockId,
			})
			.from(dbSchema.botBlock)
			.where(eq(dbSchema.botBlock.botId, botId));
		return links.map((link) => link.blockId);
	});

/** The blocks with whether they are listed and the actor manages access to them. */
const exposedBlocks = (blockIds: readonly BlockId[], actor: Actor) =>
	Effect.gen(function* () {
		if (blockIds.length === 0) return [];
		const db = yield* DB;
		const [blocks, managed] = yield* Effect.all([
			db
				.select({
					id: dbSchema.block.id,
					name: dbSchema.block.name,
					visibility: dbSchema.resourceVisibility.visibility,
				})
				.from(dbSchema.block)
				.leftJoin(dbSchema.resourceVisibility, blockVisibility)
				.where(
					inArray(dbSchema.block.id, [
						...blockIds,
					]),
				)
				.orderBy(dbSchema.block.name),
			managedIds("block", blockIds, actor),
		]);
		return blocks.map((block) => ({
			id: block.id,
			name: block.name,
			listed: block.visibility === "public",
			canManageAccess: managed.has(block.id),
		}));
	});

/** The listed bots that contain the block. */
const listedBotsContaining = (blockId: BlockId) =>
	Effect.gen(function* () {
		const db = yield* DB;
		return yield* db
			.select({
				id: dbSchema.bot.id,
				name: dbSchema.bot.name,
			})
			.from(dbSchema.botBlock)
			.innerJoin(dbSchema.bot, eq(dbSchema.bot.id, dbSchema.botBlock.botId))
			.innerJoin(
				dbSchema.resourceVisibility,
				and(
					eq(dbSchema.resourceVisibility.resourceType, "bot"),
					eq(dbSchema.resourceVisibility.resourceId, dbSchema.bot.id),
				),
			)
			.where(
				and(
					eq(dbSchema.botBlock.blockId, blockId),
					eq(dbSchema.resourceVisibility.visibility, "public"),
				),
			)
			.orderBy(dbSchema.bot.name);
	});

const writeVisibility = (
	resources: readonly ResourceRef[],
	visibility: ResourceVisibility,
	actorId: UserId,
) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const now = new Date();
		const rows = yield* Effect.forEach(resources, (resource) =>
			db
				.insert(dbSchema.resourceVisibility)
				.values({
					...resource,
					visibility,
					updatedBy: actorId,
					updatedAt: now,
				})
				.onConflictDoUpdate({
					target: [
						dbSchema.resourceVisibility.resourceType,
						dbSchema.resourceVisibility.resourceId,
					],
					set: {
						visibility,
						updatedAt: now,
						updatedBy: actorId,
					},
				})
				.returning(),
		);
		yield* recordRelationshipFacts(
			...resources.map((resource) =>
				RelationshipFact.ResourceVisibilitySet({
					resource,
					visibility,
				}),
			),
		);
		return rows.flat();
	});

/**
 * Keeps a listed bot's blocks listed: lists the unlisted ones among
 * `blockIds` when the actor manages access to each and confirmed each in
 * `confirmedIds`, else fails naming them. Call it under the locks of the
 * write that leaves the bot listed with these blocks.
 */
export const listBlocksOfListedBot = (params: {
	blockIds: readonly BlockId[];
	confirmedIds: readonly BlockId[];
	actor: Actor;
}) =>
	Effect.gen(function* () {
		const blocks = yield* exposedBlocks(params.blockIds, params.actor);
		const toList = blocksToList(blocks, params.confirmedIds);
		switch (toList._tag) {
			case "Forbidden":
				return yield* new AppErrors.ForbiddenError({
					reason: "LISTING_BLOCKS_FORBIDDEN",
					params: {
						blockNames: toList.blocks.map((block) => block.name),
					},
					message: `The bot is listed in the catalogue, so its blocks must be listed too, and you cannot manage access to: ${toList.blocks.map((block) => block.name).join(", ")}.`,
				});
			case "Unconfirmed":
				return yield* new AppErrors.BadRequestError({
					reason: "LISTING_BLOCKS_UNCONFIRMED",
					params: {
						blocks: toList.blocks.map((block) => ({
							id: block.id,
							name: block.name,
						})),
					},
					message: `The bot is listed in the catalogue, so listing it lists its blocks too: ${toList.blocks.map((block) => block.name).join(", ")}. The owner confirms that in the bot's sharing settings in the app.`,
				});
			case "List":
				yield* writeVisibility(
					toList.blockIds.map((blockId) => ({
						resourceType: "block",
						resourceId: blockId,
					})),
					"public",
					params.actor.userId,
				);
		}
	});

/** What listing or unlisting the resource involves, for its confirm dialog. */
export const listingImpact = (resource: ResourceRef, actor: Actor) =>
	Effect.gen(function* () {
		const [blocks, listedBots, organizations] = yield* Effect.all([
			resource.resourceType === "bot"
				? linkedBlockIds(resource.resourceId).pipe(
						Effect.flatMap((blockIds) => exposedBlocks(blockIds, actor)),
					)
				: Effect.succeed([]),
			resource.resourceType === "block"
				? listedBotsContaining(resource.resourceId)
				: Effect.succeed([]),
			installingOrganizations(resource),
		]);
		return {
			unlistedBlocks: blocks
				.filter((block) => !block.listed)
				.map(({ id, name, canManageAccess }) => ({
					id,
					name,
					canManageAccess,
				})),
			listedBots,
			installingOrganizations: organizations,
		};
	});

/**
 * Lists or unlists a resource. Listing a bot lists its unlisted blocks with
 * it ({@link listBlocksOfListedBot}); unlisting ends every install, and is
 * refused for a block a listed bot contains.
 */
export const setListing = (params: {
	resource: ResourceRef;
	visibility: ResourceVisibility;
	listBlockIds: readonly BlockId[];
	actor: Actor;
}) => {
	const { resource } = params;
	return writeRelationships(
		{
			organizationIds:
				resource.resourceType === "bot"
					? linkedBlockIds(resource.resourceId).pipe(
							Effect.flatMap((blockIds) =>
								resourceOrganizations([
									resource,
									...blockIds.map((blockId) => ({
										resourceType: "block" as const,
										resourceId: blockId,
									})),
								]),
							),
						)
					: resourceOrganizations([
							resource,
						]),
		},
		Effect.gen(function* () {
			if (!(yield* lockExistingResource(resource)))
				return yield* new AppErrors.NotFoundError({
					id: resource.resourceId,
					message: "Resource not found",
				});
			if (params.visibility === "public" && resource.resourceType === "asset")
				return yield* new AppErrors.BadRequestError({
					reason: "ASSET_LISTING_UNSUPPORTED",
					message:
						"Assets are not listed on their own; list the repository that holds them.",
				});
			// SpiceDB may still hold a manager grant revoked moments ago.
			const managed: ReadonlySet<string> = yield* managedIds(
				resource.resourceType,
				[
					resource.resourceId,
				],
				params.actor,
			);
			if (!managed.has(resource.resourceId))
				return yield* new AppErrors.ForbiddenError({
					reason: "PERMISSION_DENIED",
					message: `You do not have the "manage_access" permission on this ${resource.resourceType}.`,
				});

			if (params.visibility === "public" && resource.resourceType === "bot")
				yield* listBlocksOfListedBot({
					blockIds: yield* linkedBlockIds(resource.resourceId),
					confirmedIds: params.listBlockIds,
					actor: params.actor,
				});

			if (params.visibility === "private") {
				if (resource.resourceType === "block") {
					const listedBots = yield* listedBotsContaining(resource.resourceId);
					if (listedBots.length > 0)
						return yield* new AppErrors.BadRequestError({
							reason: "BLOCK_USED_BY_LISTED_BOTS",
							params: {
								botNames: listedBots.map((bot) => bot.name),
							},
							message:
								"Listed bots contain this block; unlist them or remove the block from them first.",
						});
				}
				yield* endInstalls({
					resource,
					now: new Date(),
				});
			}

			const [row] = yield* writeVisibility(
				[
					resource,
				],
				params.visibility,
				params.actor.userId,
			);
			return row;
		}),
	).pipe(Effect.map(({ result }) => result));
};

/**
 * The bots and blocks the organisation is home to that are listed in the
 * catalogue, with the organisations that installed them. Unlisting ends
 * installs, so an installed resource is always listed.
 */
export const listedHomeResources = (organizationId: OrganizationId) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const { resourceScope: home, resourceVisibility: visibility } = dbSchema;
		const install = alias(dbSchema.resourceScope, "install");
		const name = sql<string>`coalesce(${dbSchema.bot.name}, ${dbSchema.block.name})`;
		const resources = yield* db
			.select({
				resourceType: home.resourceType,
				resourceId: home.resourceId,
				name,
			})
			.from(home)
			.innerJoin(
				visibility,
				and(
					eq(visibility.resourceType, home.resourceType),
					eq(visibility.resourceId, home.resourceId),
				),
			)
			.leftJoin(
				dbSchema.bot,
				and(eq(home.resourceType, "bot"), eq(dbSchema.bot.id, home.resourceId)),
			)
			.leftJoin(
				dbSchema.block,
				and(
					eq(home.resourceType, "block"),
					eq(dbSchema.block.id, home.resourceId),
				),
			)
			.where(
				and(
					eq(home.organizationId, organizationId),
					eq(home.isPrimary, true),
					isNull(home.endedAt),
					inArray(home.resourceType, [
						"bot",
						"block",
					]),
					eq(visibility.visibility, "public"),
				),
			)
			.orderBy(home.resourceType, name);
		if (resources.length === 0) return [];

		const installs = yield* db
			.select({
				resourceId: install.resourceId,
				name: dbSchema.organization.name,
			})
			.from(install)
			.innerJoin(
				dbSchema.organization,
				eq(dbSchema.organization.id, install.organizationId),
			)
			.where(
				and(
					inArray(
						install.resourceId,
						resources.map((resource) => resource.resourceId),
					),
					eq(install.isPrimary, false),
					isNull(install.endedAt),
				),
			)
			.orderBy(dbSchema.organization.name);
		return resources.map((resource) => ({
			resourceType: resource.resourceType as "bot" | "block",
			resourceId: resource.resourceId,
			name: resource.name,
			installingOrganizations: installs
				.filter((row) => row.resourceId === resource.resourceId)
				.map((row) => row.name),
		}));
	});
