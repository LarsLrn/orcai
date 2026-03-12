import { and, count, eq, getColumns, inArray, isNull, or } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { dbSchema } from "@/db/schema";
import { auth } from "@/lib/auth/auth";
import { AuthzService } from "@/lib/effect/services/authz";
import { DB } from "@/lib/effect/services/drizzle";
import { runOrpcEffect } from "@/lib/effect/utils/orpc-helpers";
import { authed } from "@/lib/orpc/implementation/authed";
import {
	requireActiveOrganizationMiddleware,
	requirePreferencesMiddleware,
} from "@/lib/orpc/middlewares/auth";
import {
	ALL_MEMBERS_GROUP_SYSTEM_KEY,
	RESOURCE_GRANT_SOURCE,
	RESOURCE_TYPES,
	type ResourceGrantRole,
	type ResourceGrantSource,
} from "@/lib/orpc/schemas/resource";
import { inheritedSourceByResourceType } from "@/lib/orpc/schemas/user";
import {
	checkEntityPermission,
	checkManyEntityPermissions,
	hasPermission,
	lookupEntitiesByPermission,
} from "@/lib/spice-db/client";
import { unique } from "@/lib/utils/array-utils";

export const listUsers = authed.user.list
	.use(requireActiveOrganizationMiddleware)
	.handler(async ({ input, context, errors }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;
				const organizationId = context.auth.session.activeOrganizationId;
				const permission = yield* checkEntityPermission({
					entityId: organizationId,
					entityType: "organization",
					permission: "manage_members",
					userId: context.auth.user.id,
					zedToken: context.meta?.zedToken,
				});

				if (hasPermission(permission) === false) {
					return yield* Effect.fail(
						errors.FORBIDDEN({
							data: {
								allowed: false,
								permission: "manage_members",
								entityType: "organization",
							},
						}),
					);
				}

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
							.where(eq(dbSchema.member.organizationId, organizationId))
							.limit(input.pageSize)
							.offset(input.pageIndex * input.pageSize),
						db
							.select({
								count: count(),
							})
							.from(dbSchema.member)
							.where(eq(dbSchema.member.organizationId, organizationId)),
					],
					{
						concurrency: "unbounded",
					},
				);

				return {
					data,
					rowCount: rowCount.count,
				};
			}),
		),
	);

export const findUser = authed.user.find
	.use(requireActiveOrganizationMiddleware)
	.handler(async ({ input, errors, context }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;
				const organizationId = context.auth.session.activeOrganizationId;

				if (input.id !== context.auth.user.id) {
					const permission = yield* checkEntityPermission({
						entityId: organizationId,
						entityType: "organization",
						permission: "manage_members",
						userId: context.auth.user.id,
						zedToken: context.meta?.zedToken,
					});

					if (hasPermission(permission) === false) {
						return yield* Effect.fail(
							errors.FORBIDDEN({
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
					.innerJoin(
						dbSchema.user,
						eq(dbSchema.user.id, dbSchema.member.userId),
					)
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
							Effect.fromNullable(userWithMembership).pipe(
								Effect.orElse(() =>
									Effect.fail(
										errors.NOT_FOUND({
											message:
												"User is not a member of the active organization",
										}),
									),
								),
							),
						),
						Effect.map((user) => ({
							data: user,
						})),
					);
			}),
		),
	);

export const listUserAccess = authed.user.listAccess
	.use(requireActiveOrganizationMiddleware)
	.handler(async ({ input, errors, context }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;
				const organizationId = context.auth.session.activeOrganizationId;

				if (input.id !== context.auth.user.id) {
					const permission = yield* checkEntityPermission({
						entityId: organizationId,
						entityType: "organization",
						permission: "manage_members",
						userId: context.auth.user.id,
						zedToken: context.meta?.zedToken,
					});

					if (hasPermission(permission) === false) {
						return yield* Effect.fail(
							errors.FORBIDDEN({
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
				const [allowedCourses, allowedBots, allowedBlocks, allowedAssets] =
					yield* Effect.all(
						[
							lookupEntitiesByPermission({
								userId: input.id,
								permission: "read",
								entityType: "course",
								zedToken: context.meta?.zedToken,
							}).pipe(
								Effect.map((items) =>
									items.map((item) => ({
										resourceType: "course" as const,
										resourceId: item.resourceObjectId,
									})),
								),
							),
							lookupEntitiesByPermission({
								userId: input.id,
								permission: "read",
								entityType: "bot",
								zedToken: context.meta?.zedToken,
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
								zedToken: context.meta?.zedToken,
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
								zedToken: context.meta?.zedToken,
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
					...allowedCourses,
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
				const courseIds = scopedResources
					.filter((resource) => resource.resourceType === "course")
					.map((resource) => resource.resourceId);
				const botIds = scopedResources
					.filter((resource) => resource.resourceType === "bot")
					.map((resource) => resource.resourceId);
				const blockIds = scopedResources
					.filter((resource) => resource.resourceType === "block")
					.map((resource) => resource.resourceId);
				const assetIds = scopedResources
					.filter((resource) => resource.resourceType === "asset")
					.map((resource) => resource.resourceId);

				const roleForAllowedIds = (
					entityType: (typeof RESOURCE_TYPES)[number],
					ids: string[],
				) =>
					Effect.gen(function* () {
						if (ids.length === 0) {
							return new Map<string, ResourceGrantRole>();
						}

						const getAllowedSet = (
							permission: "read" | "edit" | "manage_access",
						) =>
							checkManyEntityPermissions({
								entityIds: ids,
								entityType,
								permission,
								userId: input.id,
								zedToken: context.meta?.zedToken,
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

						return new Map(
							ids
								.map((id) => {
									if (manageableIds.has(id)) {
										return [
											id,
											"manager",
										] as const;
									}
									if (editableIds.has(id)) {
										return [
											id,
											"editor",
										] as const;
									}
									if (readableIds.has(id)) {
										return [
											id,
											"viewer",
										] as const;
									}
									return null;
								})
								.filter(
									(
										entry,
									): entry is readonly [
										string,
										ResourceGrantRole,
									] => entry !== null,
								),
						);
					});

				const [courseRoles, botRoles, blockRoles, assetRoles] =
					yield* Effect.all(
						[
							roleForAllowedIds("course", courseIds),
							roleForAllowedIds("bot", botIds),
							roleForAllowedIds("block", blockIds),
							roleForAllowedIds("asset", assetIds),
						],
						{
							concurrency: "unbounded",
						},
					);

				const effectiveRoleByResource = new Map<string, ResourceGrantRole>();
				for (const [id, role] of courseRoles) {
					effectiveRoleByResource.set(`course:${id}`, role);
				}
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
							inArray(
								dbSchema.resourceVisibility.resourceId,
								scopedResourceIds,
							),
						),
					);

				const [courses, bots, blocks, assets] = yield* Effect.all(
					[
						courseIds.length > 0
							? db
									.select({
										id: dbSchema.course.id,
										name: dbSchema.course.title,
									})
									.from(dbSchema.course)
									.where(inArray(dbSchema.course.id, courseIds))
							: Effect.succeed([]),
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
					...courses,
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

				type DirectGrantSource = Extract<
					ResourceGrantSource,
					`direct:${string}`
				>;

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
			}),
		),
	);

export const me = authed.user.me.handler(async ({ context, errors }) =>
	runOrpcEffect(
		Effect.gen(function* () {
			const db = yield* DB;

			return yield* db.query.user
				.findFirst({
					where: {
						id: context.auth.user.id,
					},
				})
				.pipe(
					Effect.flatMap((user) =>
						Effect.fromNullable(user).pipe(
							Effect.orElse(() =>
								Effect.fail(
									errors.NOT_FOUND({
										message: "User not found",
									}),
								),
							),
						),
					),
					Effect.map((user) => ({
						data: user,
					})),
				);
		}),
	),
);

export const updatePassword = authed.user.updatePassword.handler(
	async ({ input, context, errors }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;

				const ctx = yield* Effect.promise(() => auth.$context);

				const passwordMatches = yield* db.query.account
					.findFirst({
						where: {
							userId: context.auth.user.id,
							providerId: "credential",
						},
					})
					.pipe(
						Effect.flatMap((account) =>
							Effect.fromNullable(account?.password).pipe(
								Effect.orElse(() =>
									Effect.fail(
										errors.NOT_FOUND({
											message: "No password found for the user",
										}),
									),
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
						errors.UNAUTHORIZED({
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

				return {
					success: true,
				};
			}),
		),
);

export const setTourState = authed.user.setTourState
	.use(requirePreferencesMiddleware)
	.handler(async ({ input, context }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;

				yield* db.update(dbSchema.user).set({
					preferences: {
						...context.preferences,
						tours: {
							...context.preferences?.tours,
							[input.tourId]: input.state,
						},
					},
				});

				return {
					success: true,
				};
			}),
		),
	);

export const setActiveOrganization = authed.user.setActiveOrganization.handler(
	async ({ input, context, errors }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;
				const authz = yield* AuthzService;
				const hasSpiceAccess = yield* checkEntityPermission({
					entityId: input.organizationId,
					entityType: "organization",
					permission: "read",
					userId: context.auth.user.id,
					zedToken: context.meta?.zedToken,
				}).pipe(
					Effect.map((permission) => hasPermission(permission) === true),
					Effect.catchAll(() => Effect.succeed(false)),
				);

				if (!hasSpiceAccess) {
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

					if (membership) {
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
					} else {
						return yield* Effect.fail(
							errors.FORBIDDEN({
								data: {
									allowed: false,
									permission: "read",
									entityType: "organization",
								},
							}),
						);
					}
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
			}),
		),
);
