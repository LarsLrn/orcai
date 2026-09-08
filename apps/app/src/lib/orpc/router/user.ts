import { ORGANIZATION_ADMIN_ROLE } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import {
	ALL_MEMBERS_GROUP_SYSTEM_KEY,
	assetIdSchema,
	blockIdSchema,
	botIdSchema,
	type InstanceUserSortKey,
	inheritedSourceByResourceType,
	RESOURCE_GRANT_SOURCE,
	RESOURCE_TYPES,
	type ResourceGrantRole,
	type ResourceGrantSource,
	type UserSortKey,
} from "@orcai/schema";
import {
	checkEntityPermission,
	checkManyEntityPermissions,
	type EntityIdFor,
	hasPermission,
	lookupEntitiesByPermission,
} from "@orcai/spice-db";
import {
	and,
	count,
	desc,
	eq,
	getColumns,
	ilike,
	inArray,
	isNull,
	ne,
	or,
	sql,
} from "drizzle-orm";
import { EffectDrizzleQueryError } from "drizzle-orm/effect-core";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import { SqlError } from "effect/unstable/sql/SqlError";
import { auth } from "@/lib/auth/auth";
import { detachAccountAccess } from "@/lib/authz/membership-detach";
import { getZedToken } from "@/lib/authz/zed-token";
import {
	AuthzService,
	enqueueRelationshipMutations,
} from "@/lib/effect/services/authz";
import * as AppErrors from "@/lib/effect/utils/errors";
import { authed } from "@/lib/orpc/implementation/authed";
import {
	requireActiveOrganizationMiddleware,
	requireInstanceAdminMiddleware,
	requirePreferencesMiddleware,
} from "@/lib/orpc/middlewares/auth";
import { unique } from "@/lib/utils/array-utils";
import { literalSearch } from "./helpers/literal-search";
import {
	assertAdminRemainsAfterRemoving,
	countRemovedAdmins,
} from "./helpers/organization-role-policy";
import { buildOrderBy, type SortExpression } from "./helpers/sorting";

/** Better Auth reads the caller's session from the request headers. */
const requireRequestHeaders = (headers: Headers | undefined) =>
	Effect.fromNullishOr(headers).pipe(
		Effect.mapError(
			() =>
				new AppErrors.BadRequestError({
					message: "Request headers are required for this action.",
				}),
		),
	);

/** Match database constraint violations through nested Effect SQL causes */
const isConstraintViolation = (error: unknown) => {
	if (
		!(error instanceof EffectDrizzleQueryError) ||
		!Cause.isCause(error.cause)
	) {
		return false;
	}

	const failure = Cause.squash(error.cause);

	return (
		failure instanceof SqlError && failure.reason._tag === "ConstraintError"
	);
};

export const listUsers = authed.user.list
	.use(requireActiveOrganizationMiddleware)
	.effect(function* ({ input, context }) {
		const db = yield* DB;
		const organizationId = context.auth.session.activeOrganizationId;
		const permission = yield* checkEntityPermission({
			entityId: organizationId,
			entityType: "organization",
			permission: "manage_members",
			userId: context.auth.user.id,
			zedToken: getZedToken(context, input),
		});

		if (hasPermission(permission) === false) {
			return yield* Effect.fail(
				new AppErrors.ForbiddenError({
					data: {
						allowed: false,
						permission: "manage_members",
						entityType: "organization",
					},
				}),
			);
		}

		const search = input.filters?.search?.trim();
		const searchLike = search ? literalSearch(search) : undefined;
		const whereClause = and(
			eq(dbSchema.member.organizationId, organizationId),
			searchLike
				? or(
						ilike(dbSchema.user.name, searchLike),
						ilike(dbSchema.user.email, searchLike),
					)
				: undefined,
		);

		const orderBy = yield* buildOrderBy({
			sort: input.sort,
			allowlist: {
				name: dbSchema.user.name,
				email: dbSchema.user.email,
				organizationRole: dbSchema.member.role,
				createdAt: dbSchema.user.createdAt,
			} satisfies Record<UserSortKey, SortExpression>,
			defaultOrder: [
				desc(dbSchema.user.createdAt),
			],
			tieBreaker: {
				id: "id",
				expression: dbSchema.user.id,
			},
		});

		const [data, [rowCount]] = yield* Effect.all(
			[
				db
					.select({
						...getColumns(dbSchema.user),
						organizationRole: dbSchema.member.role,
					})
					.from(dbSchema.member)
					.innerJoin(
						dbSchema.user,
						eq(dbSchema.user.id, dbSchema.member.userId),
					)
					.where(whereClause)
					.orderBy(...orderBy)
					.limit(input.pageSize)
					.offset(input.pageIndex * input.pageSize),
				db
					.select({
						count: count(),
					})
					.from(dbSchema.member)
					.innerJoin(
						dbSchema.user,
						eq(dbSchema.user.id, dbSchema.member.userId),
					)
					.where(whereClause),
			],
			{
				concurrency: "unbounded",
			},
		);

		return {
			data,
			rowCount: rowCount.count,
		};
	});

export const listAllUsers = authed.user.listAll
	.use(requireInstanceAdminMiddleware)
	.effect(function* ({ input }) {
		const db = yield* DB;
		const search = input.filters?.search?.trim();
		const searchLike = search ? literalSearch(search) : undefined;
		const whereClause = searchLike
			? or(
					ilike(dbSchema.user.name, searchLike),
					ilike(dbSchema.user.email, searchLike),
				)
			: undefined;

		const orderBy = yield* buildOrderBy({
			sort: input.sort,
			allowlist: {
				name: dbSchema.user.name,
				email: dbSchema.user.email,
				createdAt: dbSchema.user.createdAt,
			} satisfies Record<InstanceUserSortKey, SortExpression>,
			defaultOrder: [
				desc(dbSchema.user.createdAt),
			],
			tieBreaker: {
				id: "id",
				expression: dbSchema.user.id,
			},
		});

		const [users, [rowCount]] = yield* Effect.all(
			[
				db
					.select({
						...getColumns(dbSchema.user),
					})
					.from(dbSchema.user)
					.where(whereClause)
					.orderBy(...orderBy)
					.limit(input.pageSize)
					.offset(input.pageIndex * input.pageSize),
				db
					.select({
						count: count(),
					})
					.from(dbSchema.user)
					.where(whereClause),
			],
			{
				concurrency: "unbounded",
			},
		);

		const userIds = users.map((user) => user.id);
		const memberships =
			userIds.length === 0
				? []
				: yield* db
						.select({
							userId: dbSchema.member.userId,
							organizationId: dbSchema.member.organizationId,
							organizationName: dbSchema.organization.name,
							organizationSlug: dbSchema.organization.slug,
							role: dbSchema.member.role,
						})
						.from(dbSchema.member)
						.innerJoin(
							dbSchema.organization,
							eq(dbSchema.organization.id, dbSchema.member.organizationId),
						)
						.where(inArray(dbSchema.member.userId, userIds));

		const membershipsByUser = new Map<
			(typeof memberships)[number]["userId"],
			Array<Omit<(typeof memberships)[number], "userId">>
		>();
		for (const { userId, ...membership } of memberships) {
			const bucket = membershipsByUser.get(userId) ?? [];
			bucket.push(membership);
			membershipsByUser.set(userId, bucket);
		}

		return {
			data: users.map((user) => ({
				...user,
				memberships: membershipsByUser.get(user.id) ?? [],
			})),
			rowCount: rowCount.count,
		};
	});

export const banUser = authed.user.ban
	.use(requireInstanceAdminMiddleware)
	.effect(function* ({ input, context }) {
		if (input.userId === context.auth.user.id) {
			return yield* Effect.fail(
				new AppErrors.BadRequestError({
					message: "You cannot ban your own account.",
				}),
			);
		}

		const headers = yield* requireRequestHeaders(context.reqHeaders);

		yield* Effect.tryPromise({
			try: () =>
				auth.api.banUser({
					body: {
						userId: input.userId,
						banReason: input.reason,
					},
					headers,
				}),
			catch: (error) =>
				new AppErrors.BadRequestError({
					message:
						error instanceof Error ? error.message : "Failed to ban the user.",
				}),
		});

		return {
			success: true,
		};
	});

export const unbanUser = authed.user.unban
	.use(requireInstanceAdminMiddleware)
	.effect(function* ({ input, context }) {
		const headers = yield* requireRequestHeaders(context.reqHeaders);

		yield* Effect.tryPromise({
			try: () =>
				auth.api.unbanUser({
					body: {
						userId: input.userId,
					},
					headers,
				}),
			catch: (error) =>
				new AppErrors.BadRequestError({
					message:
						error instanceof Error
							? error.message
							: "Failed to unban the user.",
				}),
		});

		return {
			success: true,
		};
	});

export const findUser = authed.user.find
	.use(requireActiveOrganizationMiddleware)
	.effect(function* ({ input, context }) {
		const db = yield* DB;
		const organizationId = context.auth.session.activeOrganizationId;
		const zedToken = getZedToken(context, input);

		if (input.id !== context.auth.user.id) {
			const permission = yield* checkEntityPermission({
				entityId: organizationId,
				entityType: "organization",
				permission: "manage_members",
				userId: context.auth.user.id,
				zedToken,
			});

			if (hasPermission(permission) === false) {
				return yield* Effect.fail(
					new AppErrors.ForbiddenError({
						data: {
							allowed: false,
							permission: "manage_members",
							entityType: "organization",
						},
					}),
				);
			}
		}

		return yield* db
			.select({
				...getColumns(dbSchema.user),
				organizationRole: dbSchema.member.role,
			})
			.from(dbSchema.member)
			.innerJoin(dbSchema.user, eq(dbSchema.user.id, dbSchema.member.userId))
			.where(
				and(
					eq(dbSchema.member.organizationId, organizationId),
					eq(dbSchema.user.id, input.id),
				),
			)
			.limit(1)
			.pipe(
				Effect.map(([user]) => user),
				Effect.flatMap((userWithMembership) =>
					Effect.fromNullishOr(userWithMembership).pipe(
						Effect.mapError(
							() =>
								new AppErrors.NotFoundError({
									message: "User is not a member of the active organization",
								}),
						),
					),
				),
				Effect.map((user) => ({
					data: user,
				})),
			);
	});

export const listUserAccess = authed.user.listAccess
	.use(requireActiveOrganizationMiddleware)
	.effect(function* ({ input, context }) {
		const db = yield* DB;
		const organizationId = context.auth.session.activeOrganizationId;
		const zedToken = getZedToken(context, input);

		if (input.id !== context.auth.user.id) {
			const permission = yield* checkEntityPermission({
				entityId: organizationId,
				entityType: "organization",
				permission: "manage_members",
				userId: context.auth.user.id,
				zedToken,
			});

			if (hasPermission(permission) === false) {
				return yield* Effect.fail(
					new AppErrors.ForbiddenError({
						data: {
							allowed: false,
							permission: "manage_members",
							entityType: "organization",
						},
					}),
				);
			}
		}

		const resourceTypes = RESOURCE_TYPES;
		const [allowedBots, allowedBlocks, allowedAssets] = yield* Effect.all(
			[
				lookupEntitiesByPermission({
					userId: input.id,
					permission: "read",
					entityType: "bot",
					zedToken,
				}).pipe(
					Effect.map((items) =>
						items.map((item) => ({
							resourceType: "bot" as const,
							resourceId: item.resourceObjectId,
						})),
					),
				),
				lookupEntitiesByPermission({
					userId: input.id,
					permission: "read",
					entityType: "block",
					zedToken,
				}).pipe(
					Effect.map((items) =>
						items.map((item) => ({
							resourceType: "block" as const,
							resourceId: item.resourceObjectId,
						})),
					),
				),
				lookupEntitiesByPermission({
					userId: input.id,
					permission: "read",
					entityType: "asset",
					zedToken,
				}).pipe(
					Effect.map((items) =>
						items.map((item) => ({
							resourceType: "asset" as const,
							resourceId: item.resourceObjectId,
						})),
					),
				),
			],
			{
				concurrency: "unbounded",
			},
		);

		const allowedResources = [
			...allowedBots,
			...allowedBlocks,
			...allowedAssets,
		];
		if (allowedResources.length === 0) {
			return {
				data: [],
				rowCount: 0,
			};
		}

		const allAllowedIds = unique(
			allowedResources.map((resource) => resource.resourceId),
		);
		const scopedResources = yield* db
			.select({
				resourceType: dbSchema.resourceScope.resourceType,
				resourceId: dbSchema.resourceScope.resourceId,
			})
			.from(dbSchema.resourceScope)
			.where(
				and(
					eq(dbSchema.resourceScope.organizationId, organizationId),
					isNull(dbSchema.resourceScope.endedAt),
					inArray(dbSchema.resourceScope.resourceType, resourceTypes),
					inArray(dbSchema.resourceScope.resourceId, allAllowedIds),
				),
			);

		if (scopedResources.length === 0) {
			return {
				data: [],
				rowCount: 0,
			};
		}

		const scopedResourceIds = unique(
			scopedResources.map((resource) => resource.resourceId),
		);
		const botIds = botIdSchema
			.array()
			.parse(
				scopedResources
					.filter((resource) => resource.resourceType === "bot")
					.map((resource) => resource.resourceId),
			);
		const blockIds = blockIdSchema
			.array()
			.parse(
				scopedResources
					.filter((resource) => resource.resourceType === "block")
					.map((resource) => resource.resourceId),
			);
		const assetIds = assetIdSchema
			.array()
			.parse(
				scopedResources
					.filter((resource) => resource.resourceType === "asset")
					.map((resource) => resource.resourceId),
			);

		const roleForAllowedIds = <Entity extends (typeof RESOURCE_TYPES)[number]>(
			entityType: Entity,
			ids: EntityIdFor<Entity>[],
		) =>
			Effect.gen(function* () {
				if (ids.length === 0) {
					return new Map<string, ResourceGrantRole>();
				}

				const getAllowedSet = (permission: "read" | "edit" | "manage_access") =>
					checkManyEntityPermissions({
						entityIds: ids,
						entityType,
						permission,
						userId: input.id,
						zedToken,
					}).pipe(
						Effect.map(
							(response) =>
								new Set(
									response.pairs
										.map((pair) => {
											const permitted =
												pair.response.oneofKind === "item" &&
												hasPermission({
													permissionship: pair.response.item.permissionship,
												}) === true;
											const resourceId = pair.request?.resource?.objectId;
											return permitted && resourceId ? resourceId : null;
										})
										.filter((id): id is string => id !== null),
								),
						),
					);

				const [manageableIds, editableIds, readableIds] = yield* Effect.all(
					[
						getAllowedSet("manage_access"),
						getAllowedSet("edit"),
						getAllowedSet("read"),
					],
					{
						concurrency: "unbounded",
					},
				);

				const entries: Array<
					readonly [
						EntityIdFor<Entity>,
						ResourceGrantRole,
					]
				> = [];

				for (const id of ids) {
					if (manageableIds.has(id)) {
						entries.push([
							id,
							"manager",
						]);
						continue;
					}
					if (editableIds.has(id)) {
						entries.push([
							id,
							"editor",
						]);
						continue;
					}
					if (readableIds.has(id)) {
						entries.push([
							id,
							"viewer",
						]);
					}
				}

				return new Map(entries);
			});

		const [botRoles, blockRoles, assetRoles] = yield* Effect.all(
			[
				roleForAllowedIds("bot", botIds),
				roleForAllowedIds("block", blockIds),
				roleForAllowedIds("asset", assetIds),
			],
			{
				concurrency: "unbounded",
			},
		);

		const effectiveRoleByResource = new Map<string, ResourceGrantRole>();
		for (const [id, role] of botRoles) {
			effectiveRoleByResource.set(`bot:${id}`, role);
		}
		for (const [id, role] of blockRoles) {
			effectiveRoleByResource.set(`block:${id}`, role);
		}
		for (const [id, role] of assetRoles) {
			effectiveRoleByResource.set(`asset:${id}`, role);
		}

		const [[allMembersGroup], groupMemberships] = yield* Effect.all(
			[
				db
					.select({
						id: dbSchema.group.id,
					})
					.from(dbSchema.group)
					.where(
						and(
							eq(dbSchema.group.organizationId, organizationId),
							eq(dbSchema.group.kind, "system"),
							eq(dbSchema.group.systemKey, ALL_MEMBERS_GROUP_SYSTEM_KEY),
							isNull(dbSchema.group.deletedAt),
						),
					)
					.limit(1),
				db
					.select({
						groupId: dbSchema.groupMember.groupId,
					})
					.from(dbSchema.groupMember)
					.innerJoin(
						dbSchema.group,
						eq(dbSchema.group.id, dbSchema.groupMember.groupId),
					)
					.where(
						and(
							eq(dbSchema.groupMember.userId, input.id),
							isNull(dbSchema.groupMember.removedAt),
							eq(dbSchema.group.organizationId, organizationId),
							isNull(dbSchema.group.deletedAt),
						),
					),
			],
			{
				concurrency: "unbounded",
			},
		);

		const groupPrincipalIds = Array.from(
			new Set([
				...groupMemberships.map((membership) => membership.groupId),
				...(allMembersGroup
					? [
							allMembersGroup.id,
						]
					: []),
			]),
		);

		const directGrants = yield* db
			.select({
				resourceType: dbSchema.resourceGrant.resourceType,
				resourceId: dbSchema.resourceGrant.resourceId,
				role: dbSchema.resourceGrant.role,
				principalType: dbSchema.resourceGrant.principalType,
				principalId: dbSchema.resourceGrant.principalId,
				createdAt: dbSchema.resourceGrant.createdAt,
			})
			.from(dbSchema.resourceGrant)
			.where(
				and(
					inArray(dbSchema.resourceGrant.resourceType, resourceTypes),
					inArray(dbSchema.resourceGrant.resourceId, scopedResourceIds),
					isNull(dbSchema.resourceGrant.revokedAt),
					or(
						and(
							eq(dbSchema.resourceGrant.principalType, "user"),
							eq(dbSchema.resourceGrant.principalId, input.id),
						),
						groupPrincipalIds.length > 0
							? and(
									eq(dbSchema.resourceGrant.principalType, "group"),
									inArray(
										dbSchema.resourceGrant.principalId,
										groupPrincipalIds,
									),
								)
							: undefined,
					),
				),
			);

		const publicEntries = yield* db
			.select({
				resourceType: dbSchema.resourceVisibility.resourceType,
				resourceId: dbSchema.resourceVisibility.resourceId,
				updatedAt: dbSchema.resourceVisibility.updatedAt,
			})
			.from(dbSchema.resourceVisibility)
			.where(
				and(
					eq(dbSchema.resourceVisibility.visibility, "public"),
					inArray(dbSchema.resourceVisibility.resourceType, resourceTypes),
					inArray(dbSchema.resourceVisibility.resourceId, scopedResourceIds),
				),
			);

		const [bots, blocks, assets] = yield* Effect.all(
			[
				botIds.length > 0
					? db
							.select({
								id: dbSchema.bot.id,
								name: dbSchema.bot.name,
							})
							.from(dbSchema.bot)
							.where(inArray(dbSchema.bot.id, botIds))
					: Effect.succeed([]),
				blockIds.length > 0
					? db
							.select({
								id: dbSchema.block.id,
								name: dbSchema.block.name,
							})
							.from(dbSchema.block)
							.where(inArray(dbSchema.block.id, blockIds))
					: Effect.succeed([]),
				assetIds.length > 0
					? db
							.select({
								id: dbSchema.asset.id,
								name: dbSchema.asset.title,
							})
							.from(dbSchema.asset)
							.where(inArray(dbSchema.asset.id, assetIds))
					: Effect.succeed([]),
			],
			{
				concurrency: "unbounded",
			},
		);

		const names = new Map<string, string>();
		for (const item of [
			...bots,
			...blocks,
			...assets,
		]) {
			names.set(item.id, item.name);
		}

		const roleRank = {
			viewer: 1,
			editor: 2,
			manager: 3,
		} as const;

		type DirectGrantSource = Extract<ResourceGrantSource, `direct:${string}`>;

		const directByResource = new Map<
			string,
			{
				role: ResourceGrantRole;
				source: DirectGrantSource;
				createdAt: Date;
			}
		>();

		for (const grant of directGrants) {
			const key = `${grant.resourceType}:${grant.resourceId}`;
			const source =
				grant.principalType === "user"
					? RESOURCE_GRANT_SOURCE.DIRECT_USER
					: grant.principalId === allMembersGroup?.id
						? RESOURCE_GRANT_SOURCE.DIRECT_GROUP_ALL_MEMBERS
						: RESOURCE_GRANT_SOURCE.DIRECT_GROUP;

			const current = directByResource.get(key);
			if (!current || roleRank[grant.role] > roleRank[current.role]) {
				directByResource.set(key, {
					role: grant.role,
					source,
					createdAt: grant.createdAt ?? new Date(0),
				});
			}
		}

		const publicByResource = new Map(
			publicEntries.map((entry) => [
				`${entry.resourceType}:${entry.resourceId}`,
				entry.updatedAt ?? new Date(0),
			]),
		);

		const data = scopedResources
			.map((resource) => {
				const key = `${resource.resourceType}:${resource.resourceId}`;
				const effectiveRole =
					effectiveRoleByResource.get(key) ?? ("viewer" as const);
				const direct = directByResource.get(key);
				const publicAt = publicByResource.get(key);

				if (direct) {
					return {
						resourceType: resource.resourceType,
						resourceId: resource.resourceId,
						role: effectiveRole,
						source: direct.source,
						resourceName: names.get(resource.resourceId) ?? null,
						createdAt: direct.createdAt,
					};
				}

				if (publicAt) {
					return {
						resourceType: resource.resourceType,
						resourceId: resource.resourceId,
						role: effectiveRole,
						source: RESOURCE_GRANT_SOURCE.PUBLIC,
						resourceName: names.get(resource.resourceId) ?? null,
						createdAt: publicAt,
					};
				}

				return {
					resourceType: resource.resourceType,
					resourceId: resource.resourceId,
					role: effectiveRole,
					source: inheritedSourceByResourceType[resource.resourceType],
					resourceName: names.get(resource.resourceId) ?? null,
					createdAt: new Date(0),
				};
			})
			.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

		return {
			data,
			rowCount: data.length,
		};
	});

export const deleteUsers = authed.user.delete
	.use(requireInstanceAdminMiddleware)
	.effect(function* ({ input, context }) {
		const db = yield* DB;
		const authz = yield* AuthzService;
		const now = new Date();
		const userIds = Array.from(new Set(input.userIds));

		if (userIds.length !== input.userIds.length) {
			return yield* Effect.fail(
				new AppErrors.BadRequestError({
					message: "Selected users must be unique",
				}),
			);
		}

		if (userIds.includes(context.auth.user.id)) {
			return yield* Effect.fail(
				new AppErrors.BadRequestError({
					message: "You cannot delete your own account.",
				}),
			);
		}

		const eventId = yield* db.transaction((tx) =>
			Effect.gen(function* () {
				yield* tx.execute(sql`LOCK TABLE "member" IN SHARE ROW EXCLUSIVE MODE`);

				const existingUsers = yield* tx
					.select({
						id: dbSchema.user.id,
					})
					.from(dbSchema.user)
					.where(inArray(dbSchema.user.id, userIds));

				if (existingUsers.length !== userIds.length) {
					return yield* Effect.fail(
						new AppErrors.NotFoundError({
							message: "One or more selected users do not exist.",
						}),
					);
				}

				const memberships = yield* tx
					.select({
						organizationId: dbSchema.member.organizationId,
						userId: dbSchema.member.userId,
						role: dbSchema.member.role,
					})
					.from(dbSchema.member)
					.where(inArray(dbSchema.member.userId, userIds));

				const byOrganization = new Map<
					(typeof memberships)[number]["organizationId"],
					typeof memberships
				>();
				for (const membership of memberships) {
					const bucket = byOrganization.get(membership.organizationId) ?? [];
					bucket.push(membership);
					byOrganization.set(membership.organizationId, bucket);
				}

				for (const [organizationId, members] of byOrganization) {
					const removedAdminCount = countRemovedAdmins({
						members,
					});
					if (removedAdminCount === 0) {
						continue;
					}

					const [adminCountResult] = yield* tx
						.select({
							count: count(),
						})
						.from(dbSchema.member)
						.where(
							and(
								eq(dbSchema.member.organizationId, organizationId),
								eq(dbSchema.member.role, ORGANIZATION_ADMIN_ROLE),
							),
						);
					yield* assertAdminRemainsAfterRemoving({
						adminCount: Number(adminCountResult?.count ?? 0),
						removedAdminCount,
					});
				}

				if (memberships.length > 0) {
					yield* tx
						.delete(dbSchema.member)
						.where(inArray(dbSchema.member.userId, userIds));
				}

				const detached = yield* detachAccountAccess({
					tx,
					userIds,
					now,
				});

				yield* tx
					.delete(dbSchema.session)
					.where(inArray(dbSchema.session.userId, userIds));

				yield* tx
					.delete(dbSchema.account)
					.where(inArray(dbSchema.account.userId, userIds));

				yield* tx
					.delete(dbSchema.user)
					.where(inArray(dbSchema.user.id, userIds))
					.pipe(
						Effect.catchIf(isConstraintViolation, (cause) =>
							Effect.fail(
								new AppErrors.ConflictError({
									message:
										"This account still owns groups, resources, grants or invitations, so it cannot be deleted yet. Hand that content over first.",
									cause,
								}),
							),
						),
					);

				return yield* enqueueRelationshipMutations({
					tx,
					mutations: [
						...memberships.map((membership) => ({
							resourceType: "organization" as const,
							resourceId: membership.organizationId,
							relation: membership.role,
							subjectType: "user" as const,
							subjectId: membership.userId,
							operation: "delete" as const,
						})),
						...detached,
					],
				});
			}),
		);

		yield* authz
			.deliverRelationshipEvent(eventId)
			.pipe(
				Effect.catch((cause) =>
					Effect.logError(`authz.delivery_failed cause=${String(cause)}`),
				),
			);

		return {
			success: true,
			deletedCount: userIds.length,
		};
	});

export const me = authed.user.me.effect(function* ({ context }) {
	const db = yield* DB;

	return yield* db.query.user
		.findFirst({
			where: {
				id: {
					eq: context.auth.user.id,
				},
			},
		})
		.pipe(
			Effect.flatMap((user) =>
				Effect.fromNullishOr(user).pipe(
					Effect.mapError(
						() =>
							new AppErrors.NotFoundError({
								message: "User not found",
							}),
					),
				),
			),
			Effect.map((user) => ({
				data: user,
			})),
		);
});

export const updatePassword = authed.user.updatePassword.effect(function* ({
	input,
	context,
}) {
	const db = yield* DB;

	const ctx = yield* Effect.promise(() => auth.$context);

	const passwordMatches = yield* db.query.account
		.findFirst({
			where: {
				userId: {
					eq: context.auth.user.id,
				},
				providerId: "credential",
			},
		})
		.pipe(
			Effect.flatMap((account) =>
				Effect.fromNullishOr(account?.password).pipe(
					Effect.mapError(
						() =>
							new AppErrors.NotFoundError({
								message: "No password found for the user",
							}),
					),
				),
			),
			Effect.flatMap((passwordHash) =>
				Effect.promise(() =>
					ctx.password.verify({
						password: input.currentPassword,
						hash: passwordHash,
					}),
				),
			),
		);

	if (!passwordMatches) {
		return yield* Effect.fail(
			new AppErrors.UnauthorizedError({
				message: "Current password is incorrect",
			}),
		);
	}

	yield* Effect.promise(() => ctx.password.hash(input.password)).pipe(
		Effect.flatMap((newHash) =>
			Effect.promise(() =>
				ctx.internalAdapter.updatePassword(context.auth.user.id, newHash),
			),
		),
	);

	// Other sessions are revoked; the one making the change stays signed in.
	yield* db
		.delete(dbSchema.session)
		.where(
			and(
				eq(dbSchema.session.userId, context.auth.user.id),
				ne(dbSchema.session.id, context.auth.session.id),
			),
		);

	return {
		success: true,
	};
});

export const setTourState = authed.user.setTourState
	.use(requirePreferencesMiddleware)
	.effect(function* ({ input, context }) {
		const db = yield* DB;

		yield* db
			.update(dbSchema.user)
			.set({
				preferences: {
					...context.preferences,
					tours: {
						...context.preferences?.tours,
						[input.tourId]: input.state,
					},
				},
			})
			.where(eq(dbSchema.user.id, context.auth.user.id));

		return {
			success: true,
		};
	});

export const setActiveOrganization = authed.user.setActiveOrganization.effect(
	function* ({ input, context }) {
		const db = yield* DB;
		const authz = yield* AuthzService;
		const [membership] = yield* db
			.select({
				role: dbSchema.member.role,
			})
			.from(dbSchema.member)
			.where(
				and(
					eq(dbSchema.member.organizationId, input.organizationId),
					eq(dbSchema.member.userId, context.auth.user.id),
				),
			)
			.limit(1);

		if (!membership) {
			return yield* Effect.fail(
				new AppErrors.ForbiddenError({
					data: {
						allowed: false,
						permission: "read",
						entityType: "organization",
					},
				}),
			);
		}

		const hasSpiceAccess = yield* checkEntityPermission({
			entityId: input.organizationId,
			entityType: "organization",
			permission: "read",
			userId: context.auth.user.id,
			zedToken: getZedToken(context),
		}).pipe(
			Effect.map((permission) => hasPermission(permission) === true),
			Effect.catch(() => Effect.succeed(false)),
		);

		if (!hasSpiceAccess) {
			yield* authz.applyRelationshipMutations({
				mutations: [
					{
						resourceType: "organization",
						resourceId: input.organizationId,
						relation: membership.role,
						subjectType: "user",
						subjectId: context.auth.user.id,
						operation: "touch",
					},
				],
			});
		}

		yield* db
			.update(dbSchema.session)
			.set({
				activeOrganizationId: input.organizationId,
			})
			.where(eq(dbSchema.session.id, context.auth.session.id));

		return {
			success: true,
		};
	},
);
