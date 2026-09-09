import type { BlockId, UserId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import type {
	AccessAncestor,
	BlockType,
	ResourceGrantRole,
	ResourceGrant as ResourceGrantView,
	ResourceIdentity,
	ResourcePrincipal,
	ResourcePrincipalIdentity,
} from "@orcai/schema";
import {
	ALL_MEMBERS_GROUP_SYSTEM_KEY,
	assetIdSchema,
	blockIdSchema,
	botIdSchema,
	groupIdSchema,
	RESOURCE_GRANT_SOURCE,
	userIdSchema,
} from "@orcai/schema";
import type { EntityIdFor, TupleMutation } from "@orcai/spice-db";
import {
	checkManyEntityPermissions,
	hasPermission,
	lookupEntitiesByPermission,
} from "@orcai/spice-db";
import {
	and,
	desc,
	eq,
	ilike,
	inArray,
	isNull,
	notInArray,
	or,
	sql,
} from "drizzle-orm";
import * as Effect from "effect/Effect";
import { visibleGroupScope } from "@/lib/authz/group-visibility";
import { getZedToken } from "@/lib/authz/zed-token";
import { AuthzService } from "@/lib/effect/services/authz";
import * as AppErrors from "@/lib/effect/utils/errors";
import { authed } from "@/lib/orpc/implementation/authed";
import {
	assertCanGrantPrincipalMiddleware,
	requireResourcePermission,
} from "@/lib/orpc/middlewares/permission";
import { canSeeEmailIn, canSeeEmailOn } from "./helpers/can-see-email";
import { changedAt } from "./helpers/changed-at";
import { literalSearch } from "./helpers/literal-search";

type GroupPrincipal = Extract<
	ResourcePrincipal,
	{
		type: "group";
	}
>;

const roleToRelation = (role: ResourceGrantRole) => role;

const grantSourceForGroup = (
	params: Pick<GroupPrincipal, "kind" | "systemKey">,
) =>
	params.kind === "system" && params.systemKey === ALL_MEMBERS_GROUP_SYSTEM_KEY
		? RESOURCE_GRANT_SOURCE.DIRECT_GROUP_ALL_MEMBERS
		: RESOURCE_GRANT_SOURCE.DIRECT_GROUP;

const parseResourceIdentity = (resource: {
	resourceType: ResourceGrantView["resourceType"];
	resourceId: string;
}) => {
	switch (resource.resourceType) {
		case "asset":
			return {
				resourceType: "asset" as const,
				resourceId: assetIdSchema.parse(resource.resourceId),
			};
		case "block":
			return {
				resourceType: "block" as const,
				resourceId: blockIdSchema.parse(resource.resourceId),
			};
		case "bot":
			return {
				resourceType: "bot" as const,
				resourceId: botIdSchema.parse(resource.resourceId),
			};
	}
};

type ActiveGrant = typeof dbSchema.resourceGrant.$inferSelect;
type AncestorRef = AccessAncestor extends infer Ancestor
	? Ancestor extends AccessAncestor
		? Omit<Ancestor, "name">
		: never
	: never;

const principalKey = (principal: {
	principalType: string;
	principalId: string;
}) => `${principal.principalType}:${principal.principalId}`;

const splitPrincipalIds = (
	principals: readonly {
		principalType: string;
		principalId: string;
	}[],
) => ({
	userIds: userIdSchema
		.array()
		.parse(
			principals
				.filter((principal) => principal.principalType === "user")
				.map((principal) => principal.principalId),
		),
	groupIds: groupIdSchema
		.array()
		.parse(
			principals
				.filter((principal) => principal.principalType === "group")
				.map((principal) => principal.principalId),
		),
});

const activeGrantsFor = (resource: ResourceIdentity) =>
	Effect.gen(function* () {
		const db = yield* DB;
		return yield* db
			.select()
			.from(dbSchema.resourceGrant)
			.where(
				and(
					eq(dbSchema.resourceGrant.resourceType, resource.resourceType),
					eq(dbSchema.resourceGrant.resourceId, resource.resourceId),
					isNull(dbSchema.resourceGrant.revokedAt),
				),
			);
	});

/** Attaches the principal and source to grant rows; rows whose principal is gone are dropped. */
const hydrateGrants = (params: {
	grants: ActiveGrant[];
	resource: ResourceIdentity;
	userId: UserId;
	zedToken?: string;
}) =>
	Effect.gen(function* () {
		if (params.grants.length === 0) {
			return [] as ResourceGrantView[];
		}

		const db = yield* DB;
		const canSeeEmail = yield* canSeeEmailOn(params);
		const { userIds, groupIds } = splitPrincipalIds(params.grants);

		const users =
			userIds.length > 0
				? yield* db
						.select({
							id: dbSchema.user.id,
							name: dbSchema.user.name,
							...(canSeeEmail
								? {
										email: dbSchema.user.email,
									}
								: {}),
							image: dbSchema.user.image,
						})
						.from(dbSchema.user)
						.where(inArray(dbSchema.user.id, userIds))
				: [];
		const groups =
			groupIds.length > 0
				? yield* db
						.select({
							id: dbSchema.group.id,
							name: dbSchema.group.name,
							description: dbSchema.group.description,
							kind: dbSchema.group.kind,
							systemKey: dbSchema.group.systemKey,
							organizationId: dbSchema.group.organizationId,
						})
						.from(dbSchema.group)
						.where(
							and(
								inArray(dbSchema.group.id, groupIds),
								isNull(dbSchema.group.deletedAt),
							),
						)
				: [];

		const userById = new Map(
			users.map((user) => [
				String(user.id),
				user,
			]),
		);
		const groupById = new Map(
			groups.map((group) => [
				String(group.id),
				group,
			]),
		);

		const data: ResourceGrantView[] = [];
		for (const grant of params.grants) {
			const resourceIdentity = parseResourceIdentity(grant);

			if (grant.principalType === "user") {
				const principal = userById.get(String(grant.principalId));
				if (principal) {
					data.push({
						...grant,
						...resourceIdentity,
						principal: {
							type: "user",
							...principal,
						},
						source: RESOURCE_GRANT_SOURCE.DIRECT_USER,
					});
				}
				continue;
			}

			const principal = groupById.get(String(grant.principalId));
			if (principal) {
				data.push({
					...grant,
					...resourceIdentity,
					principal: {
						type: "group",
						...principal,
					},
					source: grantSourceForGroup(principal),
				});
			}
		}

		return data;
	});

const lastManagerError = () =>
	new AppErrors.BadRequestError({
		message: "At least one manager must remain on this resource",
		data: {
			code: "LAST_MANAGER_REQUIRED",
		},
	});

/** Fails when a managed resource would end up with no manager after `change` is applied. */
const ensureManagerRemains = (
	active: ActiveGrant[],
	change: (managers: Set<string>) => void,
) => {
	const before = new Set(
		active
			.filter((grant) => grant.role === "manager")
			.map((grant) => principalKey(grant)),
	);
	const after = new Set(before);
	change(after);

	return before.size > 0 && after.size === 0
		? Effect.fail(lastManagerError())
		: Effect.void;
};

const relationMutation = (params: {
	resource: ResourceIdentity;
	principal: ResourcePrincipalIdentity;
	role: ResourceGrantRole;
	operation: "touch" | "delete";
}): TupleMutation => ({
	resourceType: params.resource.resourceType,
	resourceId: params.resource.resourceId,
	relation: roleToRelation(params.role),
	subjectType: params.principal.principalType,
	subjectId: params.principal.principalId,
	subjectRelation:
		params.principal.principalType === "group" ? "member" : undefined,
	operation: params.operation,
});

/** Ancestors named in the summary; the rest are only counted. */
const ANCESTOR_NAME_LIMIT = 25;

/**
 * The bots and blocks whose grants cascade onto this resource. `block.read`
 * includes `bot->read` and `asset.read` includes `block->read`.
 */
const collectAncestors = (resource: ResourceIdentity) =>
	Effect.gen(function* () {
		const db = yield* DB;

		const botsAbove = (blockIds: BlockId[]) =>
			blockIds.length === 0
				? Effect.succeed([] as AncestorRef[])
				: db
						.selectDistinct({
							botId: dbSchema.botBlock.botId,
						})
						.from(dbSchema.botBlock)
						.where(inArray(dbSchema.botBlock.blockId, blockIds))
						.pipe(
							Effect.map((rows) =>
								rows.map(
									(row): AncestorRef => ({
										resourceType: "bot",
										resourceId: row.botId,
									}),
								),
							),
						);

		switch (resource.resourceType) {
			case "bot":
				return [] as AncestorRef[];
			case "block":
				return yield* botsAbove([
					resource.resourceId,
				]);
			case "asset": {
				const blockIds = (yield* db
					.select({
						blockId: dbSchema.blockAsset.blockId,
					})
					.from(dbSchema.blockAsset)
					.where(eq(dbSchema.blockAsset.assetId, resource.resourceId))).map(
					(row) => row.blockId,
				);
				const blocks = blockIds.map(
					(resourceId): AncestorRef => ({
						resourceType: "block",
						resourceId,
					}),
				);
				return [
					...blocks,
					...(yield* botsAbove(blockIds)),
				];
			}
		}
	});

const readableAncestorIds = <Entity extends "bot" | "block">(params: {
	entityType: Entity;
	entityIds: EntityIdFor<Entity>[];
	userId: UserId;
	zedToken?: string;
}) =>
	params.entityIds.length === 0
		? Effect.succeed(new Set<string>())
		: checkManyEntityPermissions({
				...params,
				permission: "read",
			}).pipe(
				Effect.map(
					(result) =>
						new Set(
							result.pairs.flatMap((pair) => {
								const entityId = pair.request?.resource?.objectId;
								const allowed =
									pair.response.oneofKind === "item" &&
									hasPermission({
										permissionship: pair.response.item.permissionship,
									});
								return entityId && allowed
									? [
											entityId,
										]
									: [];
							}),
						),
				),
			);

export const getInheritedAccess = authed.resource.inheritedAccess
	.use(requireResourcePermission("manage_access"))
	.effect(function* ({ input, context }) {
		const db = yield* DB;
		const ancestors = yield* collectAncestors(input);
		const botIds = ancestors.flatMap((ancestor) =>
			ancestor.resourceType === "bot"
				? [
						ancestor.resourceId,
					]
				: [],
		);
		const blockIds = ancestors.flatMap((ancestor) =>
			ancestor.resourceType === "block"
				? [
						ancestor.resourceId,
					]
				: [],
		);

		if (ancestors.length === 0) {
			return {
				data: {
					ancestors: [],
					botCount: 0,
					blockCount: 0,
					hiddenAncestorCount: 0,
					groupCount: 0,
					userCount: 0,
					throughPublic: false,
				},
			};
		}

		const ancestorIds = ancestors.map((ancestor) =>
			String(ancestor.resourceId),
		);
		const ancestorTypes = [
			...new Set(ancestors.map((ancestor) => ancestor.resourceType)),
		];
		const grants = yield* db
			.select({
				principalType: dbSchema.resourceGrant.principalType,
				principalId: dbSchema.resourceGrant.principalId,
			})
			.from(dbSchema.resourceGrant)
			.where(
				and(
					inArray(dbSchema.resourceGrant.resourceType, ancestorTypes),
					inArray(dbSchema.resourceGrant.resourceId, ancestorIds),
					isNull(dbSchema.resourceGrant.revokedAt),
				),
			);
		const { userIds, groupIds } = splitPrincipalIds(grants);

		const publicAncestors = yield* db
			.select({
				resourceId: dbSchema.resourceVisibility.resourceId,
			})
			.from(dbSchema.resourceVisibility)
			.where(
				and(
					inArray(dbSchema.resourceVisibility.resourceType, ancestorTypes),
					inArray(dbSchema.resourceVisibility.resourceId, ancestorIds),
					eq(dbSchema.resourceVisibility.visibility, "public"),
				),
			);

		const userId = context.auth.user.id;
		const zedToken = getZedToken(context);
		const [readableBots, readableBlocks] = yield* Effect.all(
			[
				readableAncestorIds({
					entityType: "bot",
					entityIds: botIds,
					userId,
					zedToken,
				}),
				readableAncestorIds({
					entityType: "block",
					entityIds: blockIds,
					userId,
					zedToken,
				}),
			],
			{
				concurrency: "unbounded",
			},
		);
		const visibleBotIds = botIds.filter((id) => readableBots.has(id));
		const visibleBlockIds = blockIds.filter((id) => readableBlocks.has(id));

		const [botRows, blockRows] = yield* Effect.all([
			visibleBotIds.length > 0
				? db
						.select({
							id: dbSchema.bot.id,
							name: dbSchema.bot.name,
						})
						.from(dbSchema.bot)
						.where(inArray(dbSchema.bot.id, visibleBotIds))
				: Effect.succeed([]),
			visibleBlockIds.length > 0
				? db
						.select({
							id: dbSchema.block.id,
							name: dbSchema.block.name,
						})
						.from(dbSchema.block)
						.where(inArray(dbSchema.block.id, visibleBlockIds))
				: Effect.succeed([]),
		]);

		const named: AccessAncestor[] = [
			...botRows.map((row) => ({
				resourceType: "bot" as const,
				resourceId: row.id,
				name: row.name,
			})),
			...blockRows.map((row) => ({
				resourceType: "block" as const,
				resourceId: row.id,
				name: row.name,
			})),
		];

		return {
			data: {
				ancestors: named.slice(0, ANCESTOR_NAME_LIMIT),
				botCount: botIds.length,
				blockCount: blockIds.length,
				hiddenAncestorCount: ancestors.length - named.length,
				groupCount: new Set(groupIds).size,
				userCount: new Set(userIds).size,
				throughPublic: publicAncestors.length > 0,
			},
		};
	});

export const listResourceGrants = authed.resource.listGrants
	.use(requireResourcePermission("manage_access"))
	.effect(function* ({ input, context }) {
		const grants = yield* activeGrantsFor(input);
		const data = yield* hydrateGrants({
			grants,
			resource: input,
			userId: context.auth.user.id,
			zedToken: getZedToken(context),
		});

		return {
			data,
			rowCount: data.length,
		};
	});

export const listResourcePrincipals = authed.resource.listPrincipals
	.use(requireResourcePermission("manage_access"))
	.effect(function* ({ input, context }) {
		const db = yield* DB;
		const scopes = yield* db
			.select({
				organizationId: dbSchema.resourceScope.organizationId,
			})
			.from(dbSchema.resourceScope)
			.where(
				and(
					eq(dbSchema.resourceScope.resourceType, input.resourceType),
					eq(dbSchema.resourceScope.resourceId, input.resourceId),
					isNull(dbSchema.resourceScope.endedAt),
				),
			);

		if (scopes.length === 0) {
			return {
				data: [],
				rowCount: 0,
			};
		}

		const orgIds = scopes.map((scope) => scope.organizationId);
		const canSeeEmail = yield* canSeeEmailIn({
			organizationIds: orgIds,
			userId: context.auth.user.id,
			zedToken: getZedToken(context),
		});
		const query = input.query?.trim();
		const searchLike = query ? literalSearch(query) : undefined;
		const wantsGroups = !input.principalType || input.principalType === "group";

		const granted = input.excludeGranted
			? yield* db
					.select({
						principalType: dbSchema.resourceGrant.principalType,
						principalId: dbSchema.resourceGrant.principalId,
					})
					.from(dbSchema.resourceGrant)
					.where(
						and(
							eq(dbSchema.resourceGrant.resourceType, input.resourceType),
							eq(dbSchema.resourceGrant.resourceId, input.resourceId),
							isNull(dbSchema.resourceGrant.revokedAt),
						),
					)
			: [];
		const { userIds: grantedUserIds, groupIds: grantedGroupIds } =
			splitPrincipalIds(granted);

		const users =
			!input.principalType || input.principalType === "user"
				? yield* db
						.selectDistinct({
							id: dbSchema.user.id,
							name: dbSchema.user.name,
							...(canSeeEmail
								? {
										email: dbSchema.user.email,
									}
								: {}),
							image: dbSchema.user.image,
						})
						.from(dbSchema.member)
						.innerJoin(
							dbSchema.user,
							eq(dbSchema.user.id, dbSchema.member.userId),
						)
						.where(
							and(
								inArray(dbSchema.member.organizationId, orgIds),
								grantedUserIds.length > 0
									? notInArray(dbSchema.user.id, grantedUserIds)
									: undefined,
								searchLike
									? or(
											ilike(dbSchema.user.name, searchLike),
											canSeeEmail
												? ilike(dbSchema.user.email, searchLike)
												: undefined,
										)
									: undefined,
							),
						)
						.limit(input.limit)
				: [];

		const groups = wantsGroups
			? yield* visibleGroupScope({
					organizationIds: orgIds,
					userId: context.auth.user.id,
					zedToken: getZedToken(context),
				}).pipe(
					Effect.flatMap((groupScope) =>
						db
							.select({
								id: dbSchema.group.id,
								name: dbSchema.group.name,
								description: dbSchema.group.description,
								kind: dbSchema.group.kind,
								systemKey: dbSchema.group.systemKey,
								organizationId: dbSchema.group.organizationId,
							})
							.from(dbSchema.group)
							.where(
								and(
									groupScope,
									isNull(dbSchema.group.deletedAt),
									grantedGroupIds.length > 0
										? notInArray(dbSchema.group.id, grantedGroupIds)
										: undefined,
									searchLike
										? ilike(dbSchema.group.name, searchLike)
										: undefined,
								),
							)
							.orderBy(desc(dbSchema.group.kind), dbSchema.group.name)
							.limit(input.limit),
					),
				)
			: [];

		const principals: ResourcePrincipal[] = [
			...users.map((user) => ({
				type: "user" as const,
				...user,
			})),
			...groups.map((group) => ({
				type: "group" as const,
				...group,
			})),
		].slice(0, input.limit);

		return {
			data: principals,
			rowCount: principals.length,
		};
	});

export const grantResourceAccess = authed.resource.grant
	.use(assertCanGrantPrincipalMiddleware)
	.effect(function* ({ input, context }) {
		const db = yield* DB;
		const authz = yield* AuthzService;
		const now = new Date();

		const { grants, mutations } = yield* db.transaction((tx) =>
			Effect.gen(function* () {
				// The manager floor is a read followed by a write, so the batch
				// takes the row lock before counting.
				yield* tx.execute(
					sql`LOCK TABLE "resource_grant" IN SHARE ROW EXCLUSIVE MODE`,
				);

				const active = yield* activeGrantsFor(input);
				const existingByPrincipal = new Map(
					active.map((grant) => [
						principalKey(grant),
						grant,
					]),
				);

				yield* ensureManagerRemains(active, (managers) => {
					for (const principal of input.principals) {
						if (input.role === "manager") {
							managers.add(principalKey(principal));
						} else {
							managers.delete(principalKey(principal));
						}
					}
				});

				const written: ActiveGrant[] = [];
				const mutations: TupleMutation[] = [];

				for (const principal of input.principals) {
					const existing = existingByPrincipal.get(principalKey(principal));

					if (existing) {
						yield* tx
							.update(dbSchema.resourceGrant)
							.set({
								revokedAt: now,
							})
							.where(eq(dbSchema.resourceGrant.id, existing.id));
					}

					const [grant] = yield* tx
						.insert(dbSchema.resourceGrant)
						.values({
							resourceType: input.resourceType,
							resourceId: input.resourceId,
							principalType: principal.principalType,
							principalId: principal.principalId,
							role: input.role,
							grantedBy: context.auth.user.id,
							createdAt: now,
							revokedAt: null,
						})
						.returning();

					if (!grant) {
						return yield* Effect.fail(
							new AppErrors.BadRequestError({
								message: "Grant could not be recorded",
							}),
						);
					}

					written.push(grant);

					if (existing && existing.role !== input.role) {
						mutations.push(
							relationMutation({
								resource: input,
								principal,
								role: existing.role,
								operation: "delete",
							}),
						);
					}

					mutations.push(
						relationMutation({
							resource: input,
							principal,
							role: input.role,
							operation: "touch",
						}),
					);
				}

				return {
					grants: written,
					mutations,
				};
			}),
		);

		const data = yield* hydrateGrants({
			grants,
			resource: input,
			userId: context.auth.user.id,
			zedToken: getZedToken(context),
		});

		yield* authz.applyRelationshipMutations({
			mutations,
		});

		return {
			data,
			rowCount: data.length,
		};
	});

export const revokeResourceAccess = authed.resource.revoke
	.use(requireResourcePermission("manage_access"))
	.effect(function* ({ input }) {
		const db = yield* DB;
		const authz = yield* AuthzService;

		const active = yield* activeGrantsFor(input);
		const revoked = active.filter(
			(grant) => principalKey(grant) === principalKey(input),
		);

		if (revoked.length === 0) {
			return {
				success: true,
				message: "No active grant to revoke",
			};
		}

		yield* ensureManagerRemains(active, (managers) => {
			managers.delete(principalKey(input));
		});

		yield* db
			.update(dbSchema.resourceGrant)
			.set({
				revokedAt: new Date(),
			})
			.where(
				inArray(
					dbSchema.resourceGrant.id,
					revoked.map((grant) => grant.id),
				),
			);

		yield* authz.applyRelationshipMutations({
			mutations: revoked.map((grant) =>
				relationMutation({
					resource: input,
					principal: input,
					role: grant.role,
					operation: "delete",
				}),
			),
		});

		return {
			success: true,
			message: "Access revoked successfully",
		};
	});

export const getResourceVisibility = authed.resource.getVisibility
	.use(requireResourcePermission("read"))
	.effect(function* ({ input }) {
		const db = yield* DB;

		const [existing] = yield* db
			.select()
			.from(dbSchema.resourceVisibility)
			.where(
				and(
					eq(dbSchema.resourceVisibility.resourceType, input.resourceType),
					eq(dbSchema.resourceVisibility.resourceId, input.resourceId),
				),
			)
			.limit(1);

		return {
			data: {
				resourceType: input.resourceType,
				resourceId: input.resourceId,
				visibility: existing?.visibility ?? "private",
			},
		};
	});

export const setResourceVisibility = authed.resource.setVisibility
	.use(requireResourcePermission("manage_access"))
	.effect(function* ({ input, context }) {
		const db = yield* DB;
		const authz = yield* AuthzService;
		const now = new Date();

		const [existing] = yield* db
			.select()
			.from(dbSchema.resourceVisibility)
			.where(
				and(
					eq(dbSchema.resourceVisibility.resourceType, input.resourceType),
					eq(dbSchema.resourceVisibility.resourceId, input.resourceId),
				),
			)
			.limit(1);

		const [data] = existing
			? yield* db
					.update(dbSchema.resourceVisibility)
					.set({
						visibility: input.visibility,
						updatedAt: now,
						updatedBy: context.auth.user.id,
					})
					.where(eq(dbSchema.resourceVisibility.id, existing.id))
					.returning()
			: yield* db
					.insert(dbSchema.resourceVisibility)
					.values({
						resourceType: input.resourceType,
						resourceId: input.resourceId,
						visibility: input.visibility,
						updatedBy: context.auth.user.id,
						updatedAt: now,
					})
					.returning();

		yield* authz.applyRelationshipMutations({
			mutations: [
				{
					resourceType: input.resourceType,
					resourceId: input.resourceId,
					relation: "public",
					subjectType: "user",
					subjectId: "*",
					operation: input.visibility === "public" ? "touch" : "delete",
				},
			],
		});

		return {
			data,
		};
	});

/** Postgres returns the coalesced timestamp as text, so normalise before comparing. */
const toTime = (value: Date | string) => new Date(value).getTime();

export const listRecentResources = authed.resource.listRecent.effect(
	function* ({ input, context }) {
		const db = yield* DB;
		const userId = context.auth.user.id;
		const zedToken = getZedToken(context, input);

		const readableIds = <TEntity extends "asset" | "block" | "bot">(
			entityType: TEntity,
		) =>
			lookupEntitiesByPermission({
				entityType,
				permission: "read",
				userId,
				zedToken,
			}).pipe(
				Effect.map((entities) =>
					entities.map((entity) => entity.resourceObjectId),
				),
			);

		const [bots, blocks, assets] = yield* Effect.all(
			[
				readableIds("bot").pipe(
					Effect.flatMap((ids) =>
						ids.length === 0
							? Effect.succeed([])
							: db
									.select({
										resourceId: dbSchema.bot.id,
										name: dbSchema.bot.name,
										status: dbSchema.bot.status,
										changedAt: changedAt(dbSchema.bot),
									})
									.from(dbSchema.bot)
									.where(inArray(dbSchema.bot.id, ids))
									.orderBy(desc(changedAt(dbSchema.bot)))
									.limit(input.limit),
					),
				),
				readableIds("block").pipe(
					Effect.flatMap((ids) =>
						ids.length === 0
							? Effect.succeed([])
							: db
									.select({
										resourceId: dbSchema.block.id,
										name: dbSchema.block.name,
										blockType: dbSchema.block.type,
										status: dbSchema.block.status,
										changedAt: changedAt(dbSchema.block),
									})
									.from(dbSchema.block)
									.where(inArray(dbSchema.block.id, ids))
									.orderBy(desc(changedAt(dbSchema.block)))
									.limit(input.limit),
					),
				),
				readableIds("asset").pipe(
					Effect.flatMap((ids) =>
						ids.length === 0
							? Effect.succeed([])
							: db
									.select({
										resourceId: dbSchema.asset.id,
										name: dbSchema.asset.title,
										processingStatus: dbSchema.asset.processingStatus,
										changedAt: changedAt(dbSchema.asset),
									})
									.from(dbSchema.asset)
									.where(inArray(dbSchema.asset.id, ids))
									.orderBy(desc(changedAt(dbSchema.asset)))
									.limit(input.limit),
					),
				),
			],
			{
				concurrency: "unbounded",
			},
		);

		const data = [
			...bots.map((bot) => ({
				resourceType: "bot" as const,
				...bot,
			})),
			...blocks.map((block) => ({
				resourceType: "block" as const,
				...block,
				blockType: block.blockType as BlockType,
			})),
			...assets.map((asset) => ({
				resourceType: "asset" as const,
				...asset,
			})),
		]
			.sort((left, right) => toTime(right.changedAt) - toTime(left.changedAt))
			.slice(0, input.limit);

		return {
			data,
			rowCount: data.length,
		};
	},
);
