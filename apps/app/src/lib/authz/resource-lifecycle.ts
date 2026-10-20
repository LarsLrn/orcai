import type {
	AssetId,
	BlockId,
	BotId,
	ChatId,
	GroupId,
	OrganizationId,
	UserId,
} from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import type { EntityIdFor, ResourceType, TupleMutation } from "@orcai/spice-db";
import { and, eq, inArray, isNull } from "drizzle-orm";
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import {
	AuthzService,
	enqueueRelationshipMutations,
} from "@/lib/effect/services/authz";
import { parseScopedResourceId } from "@/lib/orpc/router/helpers/scoped-resource-id";
import { AUTHZ } from "@/settings/constants";

type ResourceVisibility =
	typeof dbSchema.resourceVisibility.$inferSelect.visibility;

type InitialRelation = "owner" | "manager";

/**
 * Bootstraps the authorization state for a newly created resource.
 *
 * Writes three categories of data:
 * 1. **DB records** — `resourceScope` (org ownership), `resourceVisibility`,
 *    and optionally a `resourceGrant` row for the creator.
 * 2. **SpiceDB tuples** — creator relation (`owner` or `manager`), and a
 *    `public@user:*` wildcard when visibility is public.
 *
 * Must be called once, immediately after the resource row is inserted.
 *
 * @param params.visibility      - Defaults to `"private"`.
 * @param params.initialRelation - Overrides the per-type default (`"owner"` for
 *                                 most types).
 * @param params.writeManagerGrant - Whether to write a `resourceGrant` row for
 *                                   the creator. Defaults to `true` when
 *                                   `initialRelation` is `"manager"`.
 */
export const initializeResourceAuthorization = (params: {
	resourceType: ResourceType;
	resourceId: EntityIdFor<ResourceType>;
	organizationId: OrganizationId;
	ownerUserId: UserId;
	visibility?: ResourceVisibility;
	initialRelation?: InitialRelation;
	writeManagerGrant?: boolean;
}) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const authz = yield* AuthzService;
		const now = new Date();

		const visibility = params.visibility ?? "private";
		const initialRelation = params.initialRelation ?? "owner";
		const writeManagerGrant =
			params.writeManagerGrant ?? initialRelation === "manager";

		yield* db.insert(dbSchema.resourceScope).values({
			resourceType: params.resourceType,
			resourceId: params.resourceId,
			organizationId: params.organizationId,
			isPrimary: true,
			assignedAt: now,
			assignedBy: params.ownerUserId,
			endedAt: null,
		});

		yield* db.insert(dbSchema.resourceVisibility).values({
			resourceType: params.resourceType,
			resourceId: params.resourceId,
			visibility,
			updatedBy: params.ownerUserId,
			updatedAt: now,
		});

		if (writeManagerGrant) {
			yield* db.insert(dbSchema.resourceGrant).values({
				resourceType: params.resourceType,
				resourceId: params.resourceId,
				principalType: "user",
				principalId: params.ownerUserId,
				role: "manager",
				grantedBy: params.ownerUserId,
				createdAt: now,
				revokedAt: null,
			});
		}

		const mutations: TupleMutation[] = [
			{
				resourceType: params.resourceType,
				resourceId: params.resourceId,
				relation: initialRelation,
				subjectType: "user" as const,
				subjectId: params.ownerUserId,
				operation: "touch" as const,
			},
			...(visibility === "public"
				? [
						{
							resourceType: params.resourceType,
							resourceId: params.resourceId,
							relation: "public" as const,
							subjectType: "user" as const,
							subjectId: "*" as const,
							operation: "touch" as const,
						},
					]
				: []),
		];

		return yield* authz.applyRelationshipMutations({
			mutations,
		});
	});

type TransactionLike = Pick<typeof DB.Service, "select" | "delete" | "insert">;

export type TeardownState = {
	resourceType: ResourceType;
	resourceIds: readonly string[];
	owners: readonly {
		resourceId: string;
		userId: UserId;
	}[];
	activeGrants: readonly {
		resourceId: string;
		principalType: "user" | "group";
		principalId: UserId | GroupId;
		role: "viewer" | "editor" | "manager";
	}[];
	botBlocks: readonly {
		botId: BotId;
		blockId: BlockId;
	}[];
	botChats: readonly {
		chatId: ChatId;
		botId: BotId;
	}[];
	blockAssets: readonly {
		blockId: BlockId;
		assetId: AssetId;
	}[];
};

const mutationKey = (mutation: TupleMutation) =>
	`${mutation.resourceType}:${mutation.resourceId}#${mutation.relation}@${mutation.subjectType}:${mutation.subjectId}#${mutation.subjectRelation ?? ""}`;

/** The SpiceDB deletions that undo a resource's authorization state, without duplicates. */
export const buildTeardownMutations = (
	state: TeardownState,
): TupleMutation[] => {
	const resourceId = (id: string) =>
		parseScopedResourceId({
			resourceType: state.resourceType,
			resourceId: id,
		});

	const mutations: TupleMutation[] = [
		...state.resourceIds.map(
			(id): TupleMutation => ({
				resourceType: state.resourceType,
				resourceId: resourceId(id),
				relation: "public",
				subjectType: "user",
				subjectId: "*",
			}),
		),
		...state.owners.map(
			(owner): TupleMutation => ({
				resourceType: state.resourceType,
				resourceId: resourceId(owner.resourceId),
				relation: "owner",
				subjectType: "user",
				subjectId: owner.userId,
			}),
		),
		...state.activeGrants.map(
			(grant): TupleMutation =>
				grant.principalType === "group"
					? {
							resourceType: state.resourceType,
							resourceId: resourceId(grant.resourceId),
							relation: grant.role,
							subjectType: "group",
							subjectId: grant.principalId as GroupId,
							subjectRelation: "member",
						}
					: {
							resourceType: state.resourceType,
							resourceId: resourceId(grant.resourceId),
							relation: grant.role,
							subjectType: "user",
							subjectId: grant.principalId as UserId,
						},
		),
		...state.botBlocks.map(
			(link): TupleMutation => ({
				resourceType: "block",
				resourceId: link.blockId,
				relation: "bot",
				subjectType: "bot",
				subjectId: link.botId,
			}),
		),
		...state.botChats.map(
			(link): TupleMutation => ({
				resourceType: "chat",
				resourceId: link.chatId,
				relation: "bot",
				subjectType: "bot",
				subjectId: link.botId,
			}),
		),
		...state.blockAssets.map(
			(link): TupleMutation => ({
				resourceType: "asset",
				resourceId: link.assetId,
				relation: "block",
				subjectType: "block",
				subjectId: link.blockId,
			}),
		),
	];

	return Arr.dedupeWith(
		mutations,
		(left, right) => mutationKey(left) === mutationKey(right),
	).map((mutation) => ({
		...mutation,
		operation: "delete" as const,
	}));
};

const readLinks = (params: {
	tx: TransactionLike;
	resourceType: ResourceType;
	resourceIds: readonly string[];
}) =>
	Effect.gen(function* () {
		const ids = [
			...params.resourceIds,
		];

		switch (params.resourceType) {
			case "bot":
				return {
					botBlocks: yield* params.tx
						.select({
							botId: dbSchema.botBlock.botId,
							blockId: dbSchema.botBlock.blockId,
						})
						.from(dbSchema.botBlock)
						.where(inArray(dbSchema.botBlock.botId, ids as BotId[])),
					botChats: yield* params.tx
						.select({
							chatId: dbSchema.chat.id,
							botId: dbSchema.chat.botId,
						})
						.from(dbSchema.chat)
						.where(inArray(dbSchema.chat.botId, ids as BotId[]))
						.pipe(
							Effect.map((rows) =>
								rows.flatMap((row) =>
									row.botId
										? [
												{
													chatId: row.chatId,
													botId: row.botId,
												},
											]
										: [],
								),
							),
						),
					blockAssets: [],
				};
			case "block":
				return {
					botBlocks: yield* params.tx
						.select({
							botId: dbSchema.botBlock.botId,
							blockId: dbSchema.botBlock.blockId,
						})
						.from(dbSchema.botBlock)
						.where(inArray(dbSchema.botBlock.blockId, ids as BlockId[])),
					botChats: [],
					blockAssets: [],
				};
			case "asset":
				return {
					botBlocks: [],
					botChats: [],
					blockAssets: yield* params.tx
						.select({
							blockId: dbSchema.blockAsset.blockId,
							assetId: dbSchema.blockAsset.assetId,
						})
						.from(dbSchema.blockAsset)
						.where(inArray(dbSchema.blockAsset.assetId, ids as AssetId[])),
				};
		}
	});

const resourceTables = {
	bot: dbSchema.bot,
	block: dbSchema.block,
	asset: dbSchema.asset,
};

const readOwners = (params: {
	tx: TransactionLike;
	resourceType: ResourceType;
	resourceIds: readonly string[];
}) => {
	const table = resourceTables[params.resourceType];

	return params.tx
		.select({
			resourceId: table.id,
			userId: table.userId,
		})
		.from(table)
		.where(
			inArray(table.id, [
				...params.resourceIds,
			] as (typeof table.id._.data)[]),
		);
};

/**
 * Removes a resource's grants, visibility and scope rows, the inverse of
 * {@link initializeResourceAuthorization}. Call it in the transaction that
 * deletes the resource rows, before them, so the links are still there to read.
 * Returns the SpiceDB deletions to enqueue in the same transaction.
 */
export const teardownResourceAuthorization = (params: {
	tx: TransactionLike;
	resourceType: ResourceType;
	resourceIds: readonly string[];
}) =>
	Effect.gen(function* () {
		if (params.resourceIds.length === 0) return [] as TupleMutation[];

		const resourceIds = [
			...params.resourceIds,
		];
		const owners = yield* readOwners(params);
		const links = yield* readLinks(params);
		const activeGrants = yield* params.tx
			.select({
				resourceId: dbSchema.resourceGrant.resourceId,
				principalType: dbSchema.resourceGrant.principalType,
				principalId: dbSchema.resourceGrant.principalId,
				role: dbSchema.resourceGrant.role,
			})
			.from(dbSchema.resourceGrant)
			.where(
				and(
					eq(dbSchema.resourceGrant.resourceType, params.resourceType),
					inArray(dbSchema.resourceGrant.resourceId, resourceIds),
					isNull(dbSchema.resourceGrant.revokedAt),
				),
			);

		yield* params.tx
			.delete(dbSchema.resourceGrant)
			.where(
				and(
					eq(dbSchema.resourceGrant.resourceType, params.resourceType),
					inArray(dbSchema.resourceGrant.resourceId, resourceIds),
				),
			);
		yield* params.tx
			.delete(dbSchema.resourceVisibility)
			.where(
				and(
					eq(dbSchema.resourceVisibility.resourceType, params.resourceType),
					inArray(dbSchema.resourceVisibility.resourceId, resourceIds),
				),
			);
		yield* params.tx
			.delete(dbSchema.resourceScope)
			.where(
				and(
					eq(dbSchema.resourceScope.resourceType, params.resourceType),
					inArray(dbSchema.resourceScope.resourceId, resourceIds),
				),
			);

		return buildTeardownMutations({
			resourceType: params.resourceType,
			resourceIds,
			owners,
			activeGrants,
			...links,
		});
	});

/** Splits mutations into outbox events small enough for one SpiceDB write. */
export const chunkRelationshipMutations = (
	mutations: readonly TupleMutation[],
) => Arr.chunksOf(mutations, AUTHZ.outboxMutationsPerEvent);

/** Enqueues mutations as one outbox event per chunk and returns the event ids. */
export const enqueueChunkedRelationshipMutations = (params: {
	tx: Pick<typeof DB.Service, "insert">;
	mutations: readonly TupleMutation[];
}) =>
	Effect.forEach(chunkRelationshipMutations(params.mutations), (chunk) =>
		enqueueRelationshipMutations({
			tx: params.tx,
			mutations: [
				...chunk,
			],
		}),
	).pipe(
		Effect.map((eventIds) =>
			eventIds.filter((eventId) => eventId !== undefined),
		),
	);

/** Delivers committed outbox events; the outbox loop retries one that fails here. */
export const deliverRelationshipEvents = (eventIds: readonly string[]) =>
	Effect.gen(function* () {
		const authz = yield* AuthzService;

		yield* Effect.forEach(
			eventIds,
			(eventId) =>
				authz
					.deliverRelationshipEvent(eventId)
					.pipe(
						Effect.catch((cause) =>
							Effect.logError(`authz.delivery_failed cause=${String(cause)}`),
						),
					),
			{
				discard: true,
			},
		);
	});

/**
 * Deletes resource rows together with their authorization state, then
 * delivers the relationship deletions committed alongside them.
 */
export const deleteResourcesWithAuthorization = (params: {
	resourceType: ResourceType;
	resourceIds: readonly string[];
}) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const table = resourceTables[params.resourceType];

		const eventIds = yield* db.transaction((tx) =>
			Effect.gen(function* () {
				const mutations = yield* teardownResourceAuthorization({
					tx,
					...params,
				});

				yield* tx.delete(table).where(
					inArray(table.id, [
						...params.resourceIds,
					] as (typeof table.id._.data)[]),
				);

				return yield* enqueueChunkedRelationshipMutations({
					tx,
					mutations,
				});
			}),
		);

		yield* deliverRelationshipEvents(eventIds);
	});
