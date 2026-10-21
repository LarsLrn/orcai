import { DB, dbSchema } from "@orcai/db";
import {
	ALL_MEMBERS_GROUP_SYSTEM_KEY,
	assetIdSchema,
	blockIdSchema,
	botIdSchema,
	type DirectGrantSource,
	type InstanceUserSortKey,
	inheritedSourceByResourceType,
	RESOURCE_GRANT_SOURCE,
	RESOURCE_TYPES,
	type ResourceGrantRole,
	type UserSortKey,
} from "@orcai/schema";
import {
	checkEntityPermission,
	type EntityIdFor,
	grantedPermissions,
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
} from "drizzle-orm";
import * as Effect from "effect/Effect";
import { auth } from "@/lib/auth/auth";
import { touchOrganizationRoles } from "@/lib/authz/organization-lifecycle";
import {
	banAccount,
	deleteAccounts,
} from "@/lib/authz/organization-membership";
import { getZedToken } from "@/lib/authz/zed-token";
import * as AppErrors from "@/lib/effect/utils/errors";
import { authed } from "@/lib/orpc/implementation/authed";
import { createProcedures } from "@/lib/orpc/implementation/procedures";
import {
	requireActiveOrganizationMiddleware,
	requireInstanceAdminMiddleware,
	requirePreferencesMiddleware,
} from "@/lib/orpc/middlewares/auth";
import {
	permissionDenied,
	requirePermission,
} from "@/lib/orpc/middlewares/permission";
import { unique } from "@/lib/utils/array-utils";
import { literalSearch } from "./helpers/literal-search";
import { buildOrderBy, type SortExpression } from "./helpers/sorting";

/** Better Auth reads the caller's session from the request headers. */
const requireRequestHeaders = (headers: Headers | undefined) =>
	Effect.fromNullishOr(headers).pipe(
		Effect.mapError(
			() =>
				new AppErrors.BadRequestError({
					reason: "REQUEST_HEADERS_REQUIRED",
					message: "Request headers are required for this action.",
				}),
		),
	);

const listUsers = authed.user.list
	.use(requireActiveOrganizationMiddleware)
	.effect(function* ({ input, context }) {
		const db = yield* DB;
		const organizationId = context.auth.session.activeOrganizationId;
		yield* requirePermission({
			entityId: organizationId,
			entityType: "organization",
			permission: "manage_members",
			userId: context.auth.user.id,
			zedToken: getZedToken(context, input),
		});

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

const listAllUsers = authed.user.listAll
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

const banUser = authed.user.ban
	.use(requireInstanceAdminMiddleware)
	.effect(function* ({ input, context }) {
		yield* banAccount({
			userId: input.userId,
			reason: input.reason,
			actorId: context.auth.user.id,
		});

		return {
			success: true,
		};
	});

const unbanUser = authed.user.unban
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
					reason: "USER_UNBAN_FAILED",
					message:
						error instanceof Error
							? error.message
							: "Failed to unban the user.",
					cause: error,
				}),
		});

		return {
			success: true,
		};
	});

const findUser = authed.user.find
	.use(requireActiveOrganizationMiddleware)
	.effect(function* ({ input, context }) {
		const db = yield* DB;
		const organizationId = context.auth.session.activeOrganizationId;
		const zedToken = getZedToken(context, input);

		if (input.id !== context.auth.user.id) {
			yield* requirePermission({
				entityId: organizationId,
				entityType: "organization",
				permission: "manage_members",
				userId: context.auth.user.id,
				zedToken,
			});
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
									reason: "USER_NOT_MEMBER",
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

const listUserAccess = authed.user.listAccess
	.use(requireActiveOrganizationMiddleware)
	.effect(function* ({ input, context }) {
		const db = yield* DB;
		const organizationId = context.auth.session.activeOrganizationId;
		const zedToken = getZedToken(context, input);

		if (input.id !== context.auth.user.id) {
			yield* requirePermission({
				entityId: organizationId,
				entityType: "organization",
				permission: "manage_members",
				userId: context.auth.user.id,
				zedToken,
			});
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
						items.map((resourceId) => ({
							resourceType: "bot" as const,
							resourceId,
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
						items.map((resourceId) => ({
							resourceType: "block" as const,
							resourceId,
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
						items.map((resourceId) => ({
							resourceType: "asset" as const,
							resourceId,
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
				const granted = yield* grantedPermissions({
					entityIds: ids,
					entityType,
					permissions: [
						"manage_access",
						"edit",
						"read",
					],
					userId: input.id,
					zedToken,
				});

				const entries: Array<
					readonly [
						EntityIdFor<Entity>,
						ResourceGrantRole,
					]
				> = [];

				for (const id of ids) {
					const permissions = granted.get(id);
					if (permissions?.has("manage_access")) {
						entries.push([
							id,
							"manager",
						]);
						continue;
					}
					if (permissions?.has("edit")) {
						entries.push([
							id,
							"editor",
						]);
						continue;
					}
					if (permissions?.has("read")) {
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

const deleteUsers = authed.user.delete
	.use(requireInstanceAdminMiddleware)
	.effect(function* ({ input, context }) {
		const deletedCount = yield* deleteAccounts({
			userIds: input.userIds,
			actorId: context.auth.user.id,
		});

		return {
			success: true,
			deletedCount,
		};
	});

const me = authed.user.me.effect(function* ({ context }) {
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
								reason: "USER_NOT_FOUND",
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

const updatePassword = authed.user.updatePassword.effect(function* ({
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
								reason: "PASSWORD_NOT_SET",
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
				reason: "CURRENT_PASSWORD_INCORRECT",
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

const setTourState = authed.user.setTourState
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

const setActiveOrganization = authed.user.setActiveOrganization.effect(
	function* ({ input, context }) {
		const db = yield* DB;
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
				permissionDenied({
					entityType: "organization",
					permission: "read",
				}),
			);
		}

		const hasSpiceAccess = yield* checkEntityPermission({
			entityId: input.organizationId,
			entityType: "organization",
			permission: "read",
			userId: context.auth.user.id,
			zedToken: getZedToken(context),
		}).pipe(Effect.catch(() => Effect.succeed(false)));

		if (!hasSpiceAccess) {
			yield* touchOrganizationRoles({
				userId: context.auth.user.id,
				organizationIds: [
					input.organizationId,
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

export const userRouter = {
	list: listUsers,
	listAll: listAllUsers,
	find: findUser,
	listAccess: listUserAccess,
	delete: deleteUsers,
	ban: banUser,
	unban: unbanUser,
	me,
	updatePassword,
	setTourState,
	setActiveOrganization,
};

export const userProcedures = createProcedures("user", userRouter);
