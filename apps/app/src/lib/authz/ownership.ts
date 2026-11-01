import {
	type AssetId,
	type BlockId,
	type BotId,
	ORGANIZATION_ADMIN_ROLE,
	type OrganizationId,
	type UserId,
} from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import {
	and,
	asc,
	eq,
	ilike,
	inArray,
	isNull,
	notInArray,
	or,
} from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import {
	eligibleOwnerIds,
	notBanned,
	OWNER_ROLES,
} from "@/lib/authz/eligible-owner";
import {
	RelationshipFact,
	type ResourceRef,
} from "@/lib/authz/relationship-facts";
import {
	recordRelationshipFacts,
	writeRelationships,
} from "@/lib/authz/relationship-write";
import { writeGrants } from "@/lib/authz/resource-access";
import {
	homeOrganizationId,
	resourceOrganizations,
} from "@/lib/authz/resource-lifecycle";
import * as AppErrors from "@/lib/effect/utils/errors";
import { literalSearch } from "@/lib/utils/literal-search";

/**
 * Who receives content when nobody is named: the acting person when they may
 * own content there, or the organisation's earliest admin who can sign in.
 */
export type ReceiverDefault =
	| {
			kind: "actor";
			actorId: UserId;
	  }
	| {
			kind: "first-admin";
	  };

export type OwnedCounts = {
	bots: number;
	blocks: number;
	assets: number;
};

type OwnedItem = {
	resource: ResourceRef;
	ownerId: UserId;
	organizationId: OrganizationId;
};

const homeScope = (
	resourceType: ResourceRef["resourceType"],
	id: AnyPgColumn,
) =>
	and(
		eq(dbSchema.resourceScope.resourceType, resourceType),
		eq(dbSchema.resourceScope.resourceId, id),
		eq(dbSchema.resourceScope.isPrimary, true),
		isNull(dbSchema.resourceScope.endedAt),
	);

/**
 * The bots, blocks and Library assets the users own, by home organisation;
 * chat uploads are personal and never listed. `lock` holds the rows until
 * commit, for a write under the organisation's lock.
 */
const ownedItems = (params: {
	userIds: readonly UserId[];
	organizationId?: OrganizationId;
	lock?: boolean;
}) =>
	Effect.gen(function* () {
		if (params.userIds.length === 0) return [] as OwnedItem[];
		const db = yield* DB;
		const { bot, block, asset, resourceScope } = dbSchema;
		const userIds = [
			...params.userIds,
		];
		const inOrganization = params.organizationId
			? eq(resourceScope.organizationId, params.organizationId)
			: undefined;

		const bots = db
			.select({
				id: bot.id,
				ownerId: bot.userId,
				organizationId: resourceScope.organizationId,
			})
			.from(bot)
			.innerJoin(resourceScope, homeScope("bot", bot.id))
			.where(and(inArray(bot.userId, userIds), inOrganization));
		const blocks = db
			.select({
				id: block.id,
				ownerId: block.userId,
				organizationId: resourceScope.organizationId,
			})
			.from(block)
			.innerJoin(resourceScope, homeScope("block", block.id))
			.where(and(inArray(block.userId, userIds), inOrganization));
		const assets = db
			.select({
				id: asset.id,
				ownerId: asset.userId,
				organizationId: resourceScope.organizationId,
			})
			.from(asset)
			.innerJoin(resourceScope, homeScope("asset", asset.id))
			.where(
				and(
					inArray(asset.userId, userIds),
					eq(asset.origin, "library"),
					inOrganization,
				),
			);

		const [botRows, blockRows, assetRows] = yield* Effect.all(
			params.lock
				? [
						bots.for("update", {
							of: bot,
						}),
						blocks.for("update", {
							of: block,
						}),
						assets.for("update", {
							of: asset,
						}),
					]
				: [
						bots,
						blocks,
						assets,
					],
		);
		return [
			...botRows.map(
				(row): OwnedItem => ({
					resource: {
						resourceType: "bot",
						resourceId: row.id,
					},
					ownerId: row.ownerId,
					organizationId: row.organizationId,
				}),
			),
			...blockRows.map(
				(row): OwnedItem => ({
					resource: {
						resourceType: "block",
						resourceId: row.id,
					},
					ownerId: row.ownerId,
					organizationId: row.organizationId,
				}),
			),
			...assetRows.map(
				(row): OwnedItem => ({
					resource: {
						resourceType: "asset",
						resourceId: row.id,
					},
					ownerId: row.ownerId,
					organizationId: row.organizationId,
				}),
			),
		];
	});

const countKinds = (items: readonly OwnedItem[]): OwnedCounts => ({
	bots: items.filter((item) => item.resource.resourceType === "bot").length,
	blocks: items.filter((item) => item.resource.resourceType === "block").length,
	assets: items.filter((item) => item.resource.resourceType === "asset").length,
});

/** The receiver used when none is named, if any; never one of `excluded`. */
const defaultReceiverId = (params: {
	organizationId: OrganizationId;
	rule: ReceiverDefault;
	excluded: readonly UserId[];
}) =>
	Effect.gen(function* () {
		if (params.rule.kind === "actor") {
			const { actorId } = params.rule;
			if (params.excluded.includes(actorId)) return undefined;
			const eligible = yield* eligibleOwnerIds({
				organizationId: params.organizationId,
				userIds: [
					actorId,
				],
			});
			return eligible.has(actorId) ? actorId : undefined;
		}
		const db = yield* DB;
		const [admin] = yield* db
			.select({
				userId: dbSchema.member.userId,
			})
			.from(dbSchema.member)
			.innerJoin(dbSchema.user, eq(dbSchema.user.id, dbSchema.member.userId))
			.where(
				and(
					eq(dbSchema.member.organizationId, params.organizationId),
					eq(dbSchema.member.role, ORGANIZATION_ADMIN_ROLE),
					params.excluded.length > 0
						? notInArray(dbSchema.member.userId, [
								...params.excluded,
							])
						: undefined,
					notBanned(),
				),
			)
			.orderBy(asc(dbSchema.member.createdAt), asc(dbSchema.member.id))
			.limit(1);
		return admin?.userId;
	});

/** Fails unless the receiver may own content in the organisation and is not one of `excluded`. */
const requireReceiver = (params: {
	organizationId: OrganizationId;
	receiverId: UserId | undefined;
	excluded: readonly UserId[];
}) =>
	Effect.gen(function* () {
		const { receiverId } = params;
		const eligible =
			receiverId !== undefined &&
			!params.excluded.includes(receiverId) &&
			(yield* eligibleOwnerIds({
				organizationId: params.organizationId,
				userIds: [
					receiverId,
				],
			})).has(receiverId);
		if (!eligible)
			return yield* Effect.fail(
				new AppErrors.BadRequestError({
					reason: "RECEIVER_NOT_ELIGIBLE",
					message:
						"Content goes to a Member, Manager or Admin of its organization who is not banned and not leaving in the same change.",
				}),
			);
		return receiverId;
	});

/** Gives the items to the receiver and records their new owner. */
const changeOwners = (items: readonly OwnedItem[], receiverId: UserId) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const ids = (resourceType: ResourceRef["resourceType"]) =>
			items
				.filter((item) => item.resource.resourceType === resourceType)
				.map((item) => item.resource.resourceId);
		const botIds = ids("bot") as BotId[];
		const blockIds = ids("block") as BlockId[];
		const assetIds = ids("asset") as AssetId[];
		if (botIds.length > 0)
			yield* db
				.update(dbSchema.bot)
				.set({
					userId: receiverId,
				})
				.where(inArray(dbSchema.bot.id, botIds));
		if (blockIds.length > 0)
			yield* db
				.update(dbSchema.block)
				.set({
					userId: receiverId,
				})
				.where(inArray(dbSchema.block.id, blockIds));
		if (assetIds.length > 0)
			yield* db
				.update(dbSchema.asset)
				.set({
					userId: receiverId,
				})
				.where(inArray(dbSchema.asset.id, assetIds));
		yield* recordRelationshipFacts(
			...items.map((item) =>
				RelationshipFact.OwnerChanged({
					resource: item.resource,
					from: item.ownerId,
					to: receiverId,
				}),
			),
		);
	});

/**
 * Hands everything the users own in the organisation to one receiver: the
 * named one, or the default. Call it in the {@link writeRelationships} that
 * holds the organisation's lock, before their membership goes or shrinks.
 * Returns the receiver and what moved, or nothing when they own nothing there.
 */
export const handOverOwnedContent = (params: {
	organizationId: OrganizationId;
	fromUserIds: readonly UserId[];
	receiverId: UserId | undefined;
	receiverDefault: ReceiverDefault;
}) =>
	Effect.gen(function* () {
		const items = yield* ownedItems({
			userIds: params.fromUserIds,
			organizationId: params.organizationId,
			lock: true,
		});
		if (items.length === 0) return undefined;
		const receiverId = yield* requireReceiver({
			organizationId: params.organizationId,
			receiverId:
				params.receiverId ??
				(yield* defaultReceiverId({
					organizationId: params.organizationId,
					rule: params.receiverDefault,
					excluded: params.fromUserIds,
				})),
			excluded: params.fromUserIds,
		});
		yield* changeOwners(items, receiverId);
		return {
			receiverId,
			...countKinds(items),
		};
	});

/** The organisations whose locks guard what the users own, chat uploads included. */
export const ownedContentOrganizations = (userIds: readonly UserId[]) =>
	Effect.gen(function* () {
		if (userIds.length === 0) return [] as OrganizationId[];
		const db = yield* DB;
		const { bot, block, asset, resourceScope } = dbSchema;
		const owners = [
			...userIds,
		];
		const rows = yield* Effect.all([
			db
				.selectDistinct({
					organizationId: resourceScope.organizationId,
				})
				.from(bot)
				.innerJoin(resourceScope, homeScope("bot", bot.id))
				.where(inArray(bot.userId, owners)),
			db
				.selectDistinct({
					organizationId: resourceScope.organizationId,
				})
				.from(block)
				.innerJoin(resourceScope, homeScope("block", block.id))
				.where(inArray(block.userId, owners)),
			db
				.selectDistinct({
					organizationId: resourceScope.organizationId,
				})
				.from(asset)
				.innerJoin(resourceScope, homeScope("asset", asset.id))
				.where(inArray(asset.userId, owners)),
		]);
		return Arr.dedupe(rows.flat().map((row) => row.organizationId));
	});

/**
 * Hands what accounts being deleted own to one receiver per organisation,
 * named in `receivers` or the earliest admin there. Call it in the
 * {@link writeRelationships} that deletes them, holding
 * {@link ownedContentOrganizations}.
 */
export const handOverAccountsContent = (params: {
	userIds: readonly UserId[];
	receivers: readonly {
		organizationId: OrganizationId;
		userId: UserId;
	}[];
}) =>
	Effect.gen(function* () {
		const organizationIds = Arr.dedupe(
			(yield* ownedItems({
				userIds: params.userIds,
			})).map((item) => item.organizationId),
		);
		return yield* Effect.forEach(organizationIds, (organizationId) =>
			handOverOwnedContent({
				organizationId,
				fromUserIds: params.userIds,
				receiverId: params.receivers.find(
					(receiver) => receiver.organizationId === organizationId,
				)?.userId,
				receiverDefault: {
					kind: "first-admin",
				},
			}),
		);
	});

/**
 * What the users own, per home organisation, with the receiver a handover
 * would default to. Only organisations where they own something appear. The
 * caller authorises the read.
 */
export const ownedContent = (params: {
	userIds: readonly UserId[];
	organizationId?: OrganizationId;
	receiverDefault: ReceiverDefault;
}) =>
	Effect.gen(function* () {
		const items = yield* ownedItems(params);
		const byOrganization = Arr.groupBy(items, (item) => item.organizationId);
		const organizationIds = Object.keys(byOrganization) as OrganizationId[];
		if (organizationIds.length === 0) return [];
		const db = yield* DB;
		const organizations = yield* db
			.select({
				id: dbSchema.organization.id,
				name: dbSchema.organization.name,
			})
			.from(dbSchema.organization)
			.where(inArray(dbSchema.organization.id, organizationIds))
			.orderBy(asc(dbSchema.organization.name));
		return yield* Effect.forEach(organizations, (organization) =>
			Effect.gen(function* () {
				return {
					organizationId: organization.id,
					organizationName: organization.name,
					...countKinds(byOrganization[organization.id] ?? []),
					defaultReceiverId:
						(yield* defaultReceiverId({
							organizationId: organization.id,
							rule: params.receiverDefault,
							excluded: params.userIds,
						})) ?? null,
				};
			}),
		);
	});

/**
 * The members who may receive content in the organisation, matching
 * `search` by name or email, by name. The caller authorises the read.
 */
export const eligibleReceivers = (params: {
	organizationId: OrganizationId;
	search?: string;
	excluded?: readonly UserId[];
}) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const search = params.search?.trim();
		const pattern = search ? literalSearch(search) : undefined;
		const candidates = yield* db
			.select({
				id: dbSchema.user.id,
				name: dbSchema.user.name,
				email: dbSchema.user.email,
				image: dbSchema.user.image,
			})
			.from(dbSchema.member)
			.innerJoin(dbSchema.user, eq(dbSchema.user.id, dbSchema.member.userId))
			.where(
				and(
					eq(dbSchema.member.organizationId, params.organizationId),
					inArray(dbSchema.member.role, OWNER_ROLES),
					notBanned(),
					params.excluded && params.excluded.length > 0
						? notInArray(dbSchema.member.userId, [
								...params.excluded,
							])
						: undefined,
					pattern
						? or(
								ilike(dbSchema.user.name, pattern),
								ilike(dbSchema.user.email, pattern),
							)
						: undefined,
				),
			)
			.orderBy(asc(dbSchema.user.name), asc(dbSchema.user.id))
			.limit(25);
		return candidates;
	});

/** The item's owner, locked until commit, and whether it is a chat upload. */
const lockOwner = (resource: ResourceRef) =>
	Effect.gen(function* () {
		const db = yield* DB;
		switch (resource.resourceType) {
			case "bot": {
				const [row] = yield* db
					.select({
						ownerId: dbSchema.bot.userId,
					})
					.from(dbSchema.bot)
					.where(eq(dbSchema.bot.id, resource.resourceId))
					.for("update");
				return (
					row && {
						...row,
						chatUpload: false,
					}
				);
			}
			case "block": {
				const [row] = yield* db
					.select({
						ownerId: dbSchema.block.userId,
					})
					.from(dbSchema.block)
					.where(eq(dbSchema.block.id, resource.resourceId))
					.for("update");
				return (
					row && {
						...row,
						chatUpload: false,
					}
				);
			}
			case "asset": {
				const [row] = yield* db
					.select({
						ownerId: dbSchema.asset.userId,
						origin: dbSchema.asset.origin,
					})
					.from(dbSchema.asset)
					.where(eq(dbSchema.asset.id, resource.resourceId))
					.for("update");
				return (
					row && {
						ownerId: row.ownerId,
						chatUpload: row.origin === "chat",
					}
				);
			}
		}
	});

const ownerOnly = () =>
	new AppErrors.ForbiddenError({
		reason: "PERMISSION_DENIED",
		message:
			"Only the owner hands an item over, from the organization it belongs to.",
	});

/**
 * Fails unless the actor owns the item at home in `organizationId`, the
 * organisation they act in; a chat upload is never handed over. Call it
 * under the item's organisation locks.
 */
const requireOwnerAtHome = (params: {
	resource: ResourceRef;
	actorId: UserId;
	organizationId: OrganizationId;
}) =>
	Effect.gen(function* () {
		const owner = yield* lockOwner(params.resource);
		if (!owner)
			return yield* Effect.fail(
				new AppErrors.NotFoundError({
					id: params.resource.resourceId,
					message: "Resource not found",
				}),
			);
		const home = yield* homeOrganizationId(params.resource);
		if (
			owner.ownerId !== params.actorId ||
			owner.chatUpload ||
			home !== params.organizationId
		)
			return yield* Effect.fail(ownerOnly());
		return home;
	});

/** The members the item's owner may hand it to, checked in Postgres. */
export const itemReceivers = (params: {
	resource: ResourceRef;
	actorId: UserId;
	organizationId: OrganizationId;
	search?: string;
}) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const home = yield* db.transaction(() => requireOwnerAtHome(params));
		return yield* eligibleReceivers({
			organizationId: home,
			search: params.search,
			excluded: [
				params.actorId,
			],
		});
	});

/**
 * The owner hands one item to an eligible member of its home organisation,
 * the one they act in, and keeps Can manage on it. Owner, home, membership,
 * role and ban are read in Postgres under the organisations' locks.
 */
export const handOverItem = (params: {
	resource: ResourceRef;
	actorId: UserId;
	organizationId: OrganizationId;
	receiverId: UserId;
}) =>
	writeRelationships(
		{
			organizationIds: resourceOrganizations([
				params.resource,
			]),
		},
		Effect.gen(function* () {
			const home = yield* requireOwnerAtHome(params);
			const receiverId = yield* requireReceiver({
				organizationId: home,
				receiverId: params.receiverId,
				excluded: [
					params.actorId,
				],
			});
			yield* changeOwners(
				[
					{
						resource: params.resource,
						ownerId: params.actorId,
						organizationId: home,
					},
				],
				receiverId,
			);
			yield* writeGrants({
				resource: params.resource,
				organizationId: home,
				principals: [
					{
						principalType: "user",
						principalId: params.actorId,
					},
				],
				role: "manager",
				grantedBy: params.actorId,
				managedOrganizations: new Set(),
			});
			return receiverId;
		}),
	);
