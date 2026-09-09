import type { GroupId, OrganizationId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { ALL_MEMBERS_GROUP_SYSTEM_KEY, type GroupSortKey } from "@orcai/schema";
import {
	and,
	count,
	desc,
	eq,
	ilike,
	inArray,
	isNull,
	notExists,
	or,
	sql,
} from "drizzle-orm";
import * as Effect from "effect/Effect";
import {
	hasManageGroups,
	visibleGroupScope,
} from "@/lib/authz/group-visibility";
import { getZedToken } from "@/lib/authz/zed-token";
import { AuthzService } from "@/lib/effect/services/authz";
import * as AppErrors from "@/lib/effect/utils/errors";
import { authed } from "@/lib/orpc/implementation/authed";
import { requireActiveOrganizationMiddleware } from "@/lib/orpc/middlewares/auth";
import { requireOrganizationPermission } from "@/lib/orpc/middlewares/permission";
import { literalSearch } from "./helpers/literal-search";
import { parseScopedResourceId } from "./helpers/scoped-resource-id";
import { buildOrderBy, type SortExpression } from "./helpers/sorting";

/** Matches the search term against the user name, and the email when it is visible. */
const userSearch = (params: {
	queryLike: string | undefined;
	canSeeEmail: boolean;
}) =>
	params.queryLike
		? or(
				ilike(dbSchema.user.name, params.queryLike),
				params.canSeeEmail
					? ilike(dbSchema.user.email, params.queryLike)
					: undefined,
			)
		: undefined;

const userColumns = (canSeeEmail: boolean) => ({
	id: dbSchema.user.id,
	name: dbSchema.user.name,
	...(canSeeEmail
		? {
				email: dbSchema.user.email,
			}
		: {}),
	image: dbSchema.user.image,
});

const findOrganizationGroup = (params: {
	groupId: GroupId;
	organizationId: OrganizationId;
}) =>
	Effect.gen(function* () {
		const db = yield* DB;

		const [group] = yield* db
			.select({
				id: dbSchema.group.id,
				kind: dbSchema.group.kind,
			})
			.from(dbSchema.group)
			.where(
				and(
					eq(dbSchema.group.id, params.groupId),
					eq(dbSchema.group.organizationId, params.organizationId),
					isNull(dbSchema.group.deletedAt),
				),
			)
			.limit(1);

		if (!group) {
			return yield* Effect.fail(
				new AppErrors.NotFoundError({
					message: "Group not found",
				}),
			);
		}

		return group;
	});

/** The custom group of this organisation, or a failure explaining why it cannot be edited. */
const requireCustomGroup = (params: {
	groupId: GroupId;
	organizationId: OrganizationId;
}) =>
	Effect.gen(function* () {
		const group = yield* findOrganizationGroup(params);

		if (group.kind === "system") {
			return yield* Effect.fail(
				new AppErrors.BadRequestError({
					message: "[SYSTEM_GROUP_IMMUTABLE] System groups cannot be modified",
				}),
			);
		}

		return group;
	});

export const listGroups = authed.group.list
	.use(requireActiveOrganizationMiddleware)
	.effect(function* ({ input, context }) {
		const db = yield* DB;
		const organizationId = context.auth.session.activeOrganizationId;

		const scope = yield* visibleGroupScope({
			organizationIds: [
				organizationId,
			],
			userId: context.auth.user.id,
			zedToken: getZedToken(context),
		});

		const queryLike = input.filters?.search
			? literalSearch(input.filters.search.trim())
			: undefined;

		const whereClause = and(
			scope,
			isNull(dbSchema.group.deletedAt),
			queryLike ? ilike(dbSchema.group.name, queryLike) : undefined,
		);

		const orderBy = yield* buildOrderBy({
			sort: input.sort,
			allowlist: {
				name: dbSchema.group.name,
				kind: dbSchema.group.kind,
				createdAt: dbSchema.group.createdAt,
				updatedAt: dbSchema.group.updatedAt,
			} satisfies Record<GroupSortKey, SortExpression>,
			defaultOrder: [
				desc(dbSchema.group.createdAt),
			],
			tieBreaker: {
				id: "id",
				expression: dbSchema.group.id,
			},
		});

		const [data, [rowCount]] = yield* Effect.all(
			[
				db
					.select()
					.from(dbSchema.group)
					.where(whereClause)
					.orderBy(...orderBy)
					.limit(input.pageSize)
					.offset(input.pageIndex * input.pageSize),
				db
					.select({
						count: count(),
					})
					.from(dbSchema.group)
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

export const findGroup = authed.group.find
	.use(requireActiveOrganizationMiddleware)
	.effect(function* ({ input, context }) {
		const db = yield* DB;
		const organizationId = context.auth.session.activeOrganizationId;

		const scope = yield* visibleGroupScope({
			organizationIds: [
				organizationId,
			],
			userId: context.auth.user.id,
			zedToken: getZedToken(context),
		});

		const [group] = yield* db
			.select()
			.from(dbSchema.group)
			.where(
				and(
					eq(dbSchema.group.id, input.id),
					scope,
					isNull(dbSchema.group.deletedAt),
				),
			)
			.limit(1);

		if (!group) {
			return yield* Effect.fail(
				new AppErrors.NotFoundError({
					message: "Group not found",
				}),
			);
		}

		return {
			data: group,
		};
	});

export const createGroup = authed.group.create
	.use(requireOrganizationPermission("manage_groups"))
	.effect(function* ({ input, context }) {
		const db = yield* DB;
		const authz = yield* AuthzService;
		const organizationId = context.auth.session.activeOrganizationId;
		const now = new Date();

		const [created] = yield* db
			.insert(dbSchema.group)
			.values({
				organizationId,
				name: input.name,
				description: input.description,
				kind: "custom",
				systemKey: null,
				createdBy: context.auth.user.id,
				createdAt: now,
				updatedAt: now,
				deletedAt: null,
			})
			.returning();

		yield* authz.applyRelationshipMutations({
			mutations: [
				{
					resourceType: "group",
					resourceId: created.id,
					relation: "organization",
					subjectType: "organization",
					subjectId: organizationId,
					operation: "touch",
				},
			],
		});

		return {
			data: created,
		};
	});

export const updateGroup = authed.group.update
	.use(requireOrganizationPermission("manage_groups"))
	.effect(function* ({ input, context }) {
		const db = yield* DB;
		const organizationId = context.auth.session.activeOrganizationId;

		const [existing] = yield* db
			.select({
				id: dbSchema.group.id,
				kind: dbSchema.group.kind,
			})
			.from(dbSchema.group)
			.where(
				and(
					eq(dbSchema.group.id, input.id),
					eq(dbSchema.group.organizationId, organizationId),
					isNull(dbSchema.group.deletedAt),
				),
			)
			.limit(1);

		if (!existing) {
			return yield* Effect.fail(
				new AppErrors.NotFoundError({
					message: "Group not found",
				}),
			);
		}

		if (existing.kind === "system") {
			return yield* Effect.fail(
				new AppErrors.BadRequestError({
					message: "[SYSTEM_GROUP_IMMUTABLE] System groups cannot be modified",
				}),
			);
		}

		const [updated] = yield* db
			.update(dbSchema.group)
			.set({
				name: input.name,
				description: input.description,
				updatedAt: new Date(),
			})
			.where(eq(dbSchema.group.id, input.id))
			.returning();

		return {
			data: updated,
		};
	});

export const deleteGroups = authed.group.delete
	.use(requireOrganizationPermission("manage_groups"))
	.effect(function* ({ input, context }) {
		const db = yield* DB;
		const authz = yield* AuthzService;
		const organizationId = context.auth.session.activeOrganizationId;
		const now = new Date();

		const groupIds = input.refs.map((ref) => ref.id);

		const existingGroups = yield* db
			.select({
				id: dbSchema.group.id,
				kind: dbSchema.group.kind,
			})
			.from(dbSchema.group)
			.where(
				and(
					inArray(dbSchema.group.id, groupIds),
					eq(dbSchema.group.organizationId, organizationId),
					isNull(dbSchema.group.deletedAt),
				),
			);

		if (existingGroups.length !== groupIds.length) {
			return yield* Effect.fail(
				new AppErrors.NotFoundError({
					message: "One or more groups were not found",
				}),
			);
		}

		if (existingGroups.some((group) => group.kind === "system")) {
			return yield* Effect.fail(
				new AppErrors.BadRequestError({
					message: "[SYSTEM_GROUP_IMMUTABLE] System groups cannot be deleted",
				}),
			);
		}

		const existingGroupIds = existingGroups.map((group) => group.id);

		const membersToRemove = yield* db
			.select({
				groupId: dbSchema.groupMember.groupId,
				userId: dbSchema.groupMember.userId,
			})
			.from(dbSchema.groupMember)
			.where(
				and(
					inArray(dbSchema.groupMember.groupId, existingGroupIds),
					isNull(dbSchema.groupMember.removedAt),
				),
			);

		const activeGrants = yield* db
			.select({
				id: dbSchema.resourceGrant.id,
				resourceType: dbSchema.resourceGrant.resourceType,
				resourceId: dbSchema.resourceGrant.resourceId,
				role: dbSchema.resourceGrant.role,
				principalId: dbSchema.resourceGrant.principalId,
			})
			.from(dbSchema.resourceGrant)
			.where(
				and(
					eq(dbSchema.resourceGrant.principalType, "group"),
					inArray(dbSchema.resourceGrant.principalId, existingGroupIds),
					isNull(dbSchema.resourceGrant.revokedAt),
				),
			);

		yield* db
			.update(dbSchema.groupMember)
			.set({
				removedAt: now,
			})
			.where(
				and(
					inArray(dbSchema.groupMember.groupId, existingGroupIds),
					isNull(dbSchema.groupMember.removedAt),
				),
			);

		yield* db
			.update(dbSchema.resourceGrant)
			.set({
				revokedAt: now,
			})
			.where(
				and(
					eq(dbSchema.resourceGrant.principalType, "group"),
					inArray(dbSchema.resourceGrant.principalId, existingGroupIds),
					isNull(dbSchema.resourceGrant.revokedAt),
				),
			);

		yield* db
			.update(dbSchema.group)
			.set({
				deletedAt: now,
				updatedAt: now,
			})
			.where(inArray(dbSchema.group.id, existingGroupIds));

		yield* authz.applyRelationshipMutations({
			mutations: [
				...existingGroupIds.map((groupId) => ({
					resourceType: "group" as const,
					resourceId: groupId,
					relation: "organization" as const,
					subjectType: "organization" as const,
					subjectId: organizationId,
					operation: "delete" as const,
				})),
				...membersToRemove.map((member) => ({
					resourceType: "group" as const,
					resourceId: member.groupId,
					relation: "member" as const,
					subjectType: "user" as const,
					subjectId: member.userId,
					operation: "delete" as const,
				})),
				...activeGrants.map((grant) => ({
					resourceType: grant.resourceType,
					resourceId: parseScopedResourceId(grant),
					relation: grant.role,
					subjectType: "group" as const,
					subjectId: grant.principalId,
					subjectRelation: "member" as const,
					operation: "delete" as const,
				})),
			],
		});

		return {
			success: true,
			message: "Groups deleted successfully",
		};
	});

export const listGroupMembers = authed.group.listMembers
	.use(requireActiveOrganizationMiddleware)
	.effect(function* ({ input, context }) {
		const db = yield* DB;
		const organizationId = context.auth.session.activeOrganizationId;

		const scope = yield* visibleGroupScope({
			organizationIds: [
				organizationId,
			],
			userId: context.auth.user.id,
			zedToken: getZedToken(context),
		});

		const [group] = yield* db
			.select({
				id: dbSchema.group.id,
				organizationId: dbSchema.group.organizationId,
				kind: dbSchema.group.kind,
				systemKey: dbSchema.group.systemKey,
			})
			.from(dbSchema.group)
			.where(
				and(
					eq(dbSchema.group.id, input.groupId),
					scope,
					isNull(dbSchema.group.deletedAt),
				),
			)
			.limit(1);

		if (!group) {
			return yield* Effect.fail(
				new AppErrors.NotFoundError({
					message: "Group not found",
				}),
			);
		}

		const canSeeEmail = yield* hasManageGroups({
			organizationId,
			userId: context.auth.user.id,
			zedToken: getZedToken(context),
		});
		const searchClause = userSearch({
			queryLike: input.query ? literalSearch(input.query.trim()) : undefined,
			canSeeEmail,
		});

		if (
			group.kind === "system" &&
			group.systemKey === ALL_MEMBERS_GROUP_SYSTEM_KEY
		) {
			const whereClause = and(
				eq(dbSchema.member.organizationId, organizationId),
				searchClause,
			);

			const [data, [rowCount]] = yield* Effect.all(
				[
					db
						.select({
							user: userColumns(canSeeEmail),
						})
						.from(dbSchema.member)
						.innerJoin(
							dbSchema.user,
							eq(dbSchema.user.id, dbSchema.member.userId),
						)
						.where(whereClause)
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
				data: data.map((row) => ({
					user: row.user,
					source: "implicit" as const,
					addedAt: null,
					addedBy: null,
				})),
				rowCount: rowCount.count,
			};
		}

		const whereClause = and(
			eq(dbSchema.groupMember.groupId, group.id),
			isNull(dbSchema.groupMember.removedAt),
			searchClause,
		);

		const [data, [rowCount]] = yield* Effect.all(
			[
				db
					.select({
						user: userColumns(canSeeEmail),
						addedAt: dbSchema.groupMember.createdAt,
						addedBy: dbSchema.groupMember.addedBy,
					})
					.from(dbSchema.groupMember)
					.innerJoin(
						dbSchema.user,
						eq(dbSchema.user.id, dbSchema.groupMember.userId),
					)
					.where(whereClause)
					.limit(input.pageSize)
					.offset(input.pageIndex * input.pageSize),
				db
					.select({
						count: count(),
					})
					.from(dbSchema.groupMember)
					.innerJoin(
						dbSchema.user,
						eq(dbSchema.user.id, dbSchema.groupMember.userId),
					)
					.where(whereClause),
			],
			{
				concurrency: "unbounded",
			},
		);

		return {
			data: data.map((row) => ({
				user: row.user,
				source: "explicit" as const,
				addedAt: row.addedAt,
				addedBy: row.addedBy,
			})),
			rowCount: rowCount.count,
		};
	});

export const listGroupCandidates = authed.group.listCandidates
	.use(requireOrganizationPermission("manage_groups"))
	.effect(function* ({ input, context }) {
		const db = yield* DB;
		const organizationId = context.auth.session.activeOrganizationId;

		const group = yield* findOrganizationGroup({
			groupId: input.groupId,
			organizationId,
		});

		if (group.kind === "system") {
			return {
				data: [],
				rowCount: 0,
			};
		}

		const canSeeEmail = yield* hasManageGroups({
			organizationId,
			userId: context.auth.user.id,
			zedToken: getZedToken(context),
		});

		const data = yield* db
			.select(userColumns(canSeeEmail))
			.from(dbSchema.member)
			.innerJoin(dbSchema.user, eq(dbSchema.user.id, dbSchema.member.userId))
			.where(
				and(
					eq(dbSchema.member.organizationId, organizationId),
					notExists(
						db
							.select({
								one: sql`1`,
							})
							.from(dbSchema.groupMember)
							.where(
								and(
									eq(dbSchema.groupMember.groupId, group.id),
									eq(dbSchema.groupMember.userId, dbSchema.user.id),
									isNull(dbSchema.groupMember.removedAt),
								),
							),
					),
					userSearch({
						queryLike: input.query
							? literalSearch(input.query.trim())
							: undefined,
						canSeeEmail,
					}),
				),
			)
			.orderBy(dbSchema.user.name)
			.limit(input.limit);

		return {
			data,
			rowCount: data.length,
		};
	});

export const addGroupMembers = authed.group.addMembers
	.use(requireOrganizationPermission("manage_groups"))
	.effect(function* ({ input, context }) {
		const db = yield* DB;
		const authz = yield* AuthzService;
		const organizationId = context.auth.session.activeOrganizationId;
		const now = new Date();

		yield* requireCustomGroup({
			groupId: input.groupId,
			organizationId,
		});

		const members = yield* db
			.select({
				userId: dbSchema.member.userId,
			})
			.from(dbSchema.member)
			.where(
				and(
					eq(dbSchema.member.organizationId, organizationId),
					inArray(dbSchema.member.userId, input.userIds),
				),
			);

		const validUserIds = new Set(members.map((item) => item.userId));
		const rejectedUserIds = input.userIds.filter(
			(userId) => !validUserIds.has(userId),
		);

		if (rejectedUserIds.length > 0) {
			return yield* Effect.fail(
				new AppErrors.BadRequestError({
					message:
						"[GROUP_MEMBERS_INVALID] Group members must belong to this organisation",
					data: {
						code: "GROUP_MEMBERS_INVALID",
						userIds: rejectedUserIds,
					},
				}),
			);
		}

		yield* db.transaction((tx) =>
			Effect.gen(function* () {
				const existing = yield* tx
					.select({
						userId: dbSchema.groupMember.userId,
						removedAt: dbSchema.groupMember.removedAt,
					})
					.from(dbSchema.groupMember)
					.where(
						and(
							eq(dbSchema.groupMember.groupId, input.groupId),
							inArray(dbSchema.groupMember.userId, input.userIds),
						),
					);

				const existingByUserId = new Map(
					existing.map((row) => [
						row.userId,
						row,
					]),
				);
				const toInsert = input.userIds.filter(
					(userId) => !existingByUserId.has(userId),
				);
				const toRestore = input.userIds.filter(
					(userId) => existingByUserId.get(userId)?.removedAt != null,
				);

				if (toRestore.length > 0) {
					yield* tx
						.update(dbSchema.groupMember)
						.set({
							removedAt: null,
							addedBy: context.auth.user.id,
							createdAt: now,
						})
						.where(
							and(
								eq(dbSchema.groupMember.groupId, input.groupId),
								inArray(dbSchema.groupMember.userId, toRestore),
							),
						);
				}

				if (toInsert.length > 0) {
					yield* tx.insert(dbSchema.groupMember).values(
						toInsert.map((userId) => ({
							groupId: input.groupId,
							userId,
							addedBy: context.auth.user.id,
							createdAt: now,
							removedAt: null,
						})),
					);
				}
			}),
		);

		yield* authz.applyRelationshipMutations({
			mutations: input.userIds.map((userId) => ({
				resourceType: "group" as const,
				resourceId: input.groupId,
				relation: "member" as const,
				subjectType: "user" as const,
				subjectId: userId,
				operation: "touch" as const,
			})),
		});

		return {
			success: true,
			message: "Group members updated successfully",
		};
	});

export const removeGroupMembers = authed.group.removeMembers
	.use(requireOrganizationPermission("manage_groups"))
	.effect(function* ({ input, context }) {
		const db = yield* DB;
		const authz = yield* AuthzService;

		const organizationId = context.auth.session.activeOrganizationId;
		const now = new Date();

		yield* requireCustomGroup({
			groupId: input.groupId,
			organizationId,
		});

		const activeMembers = yield* db
			.select({
				userId: dbSchema.groupMember.userId,
			})
			.from(dbSchema.groupMember)
			.where(
				and(
					eq(dbSchema.groupMember.groupId, input.groupId),
					inArray(dbSchema.groupMember.userId, input.userIds),
					isNull(dbSchema.groupMember.removedAt),
				),
			);

		if (activeMembers.length === 0) {
			return {
				success: true,
				message: "No active members to remove",
			};
		}

		const removedUserIds = activeMembers.map((member) => member.userId);

		yield* db
			.update(dbSchema.groupMember)
			.set({
				removedAt: now,
			})
			.where(
				and(
					eq(dbSchema.groupMember.groupId, input.groupId),
					inArray(dbSchema.groupMember.userId, removedUserIds),
					isNull(dbSchema.groupMember.removedAt),
				),
			);

		yield* authz.applyRelationshipMutations({
			mutations: removedUserIds.map((userId) => ({
				resourceType: "group" as const,
				resourceId: input.groupId,
				relation: "member" as const,
				subjectType: "user" as const,
				subjectId: userId,
				operation: "delete" as const,
			})),
		});

		return {
			success: true,
			message: "Group members removed successfully",
		};
	});
