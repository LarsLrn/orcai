import type { GroupId, OrganizationId, UserId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { ALL_MEMBERS_GROUP_SYSTEM_KEY } from "@orcai/schema";
import { permittedEntityIds, type ReadRevision } from "@orcai/spice-db";
import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { QueryBuilder } from "drizzle-orm/pg-core";
import * as Effect from "effect/Effect";
import {
	committedRoles,
	organizationPermitted,
	roleGrants,
} from "@/lib/authz/organization-access";

type PermissionParams = {
	userId: UserId;
	zedToken?: ReadRevision | null | undefined;
};

/** Whether the caller manages the groups of one organisation. */
export const hasManageGroups = (
	params: PermissionParams & {
		organizationId: OrganizationId;
	},
) =>
	organizationPermitted({
		organizationId: params.organizationId,
		userId: params.userId,
		permission: "manage_groups",
		zedToken: params.zedToken ?? undefined,
	});

/** The organisations whose groups the caller manages, by committed role and in SpiceDB. */
export const organizationsWithManageGroups = (
	params: PermissionParams & {
		organizationIds: readonly OrganizationId[];
	},
) =>
	Effect.gen(function* () {
		const [permitted, roles] = yield* Effect.all(
			[
				permittedEntityIds({
					entityType: "organization",
					entityIds: params.organizationIds,
					permission: "manage_groups",
					userId: params.userId,
					zedToken: params.zedToken,
				}),
				committedRoles({
					userId: params.userId,
					organizationIds: params.organizationIds,
				}),
			],
			{
				concurrency: "unbounded",
			},
		);
		return new Set(
			[
				...permitted,
			].filter((id) => {
				const role = roles.get(id);
				return role !== undefined && roleGrants(role, "manage_groups");
			}),
		);
	});

const isAllMembersGroup = and(
	eq(dbSchema.group.kind, "system"),
	eq(dbSchema.group.systemKey, ALL_MEMBERS_GROUP_SYSTEM_KEY),
);

const groupsOf = (userId: UserId) =>
	new QueryBuilder()
		.select({
			groupId: dbSchema.groupMember.groupId,
		})
		.from(dbSchema.groupMember)
		.where(
			and(
				eq(dbSchema.groupMember.userId, userId),
				isNull(dbSchema.groupMember.removedAt),
			),
		);

/** Groups of `managed` organisations, plus All Members and own groups of `unmanaged` ones. */
export const groupScopeCondition = (params: {
	userId: UserId;
	managed: readonly OrganizationId[];
	unmanaged: readonly OrganizationId[];
}) => {
	if (params.managed.length === 0 && params.unmanaged.length === 0) {
		return sql`false`;
	}

	return or(
		inArray(dbSchema.group.organizationId, [
			...params.managed,
		]),
		and(
			inArray(dbSchema.group.organizationId, [
				...params.unmanaged,
			]),
			or(
				isAllMembersGroup,
				inArray(dbSchema.group.id, groupsOf(params.userId)),
			),
		),
	);
};

/** The groups of `organizationIds` the caller may see, as a condition on `dbSchema.group`. */
export const visibleGroupScope = (
	params: PermissionParams & {
		organizationIds: readonly OrganizationId[];
	},
) =>
	Effect.gen(function* () {
		const managed = yield* organizationsWithManageGroups(params);

		return groupScopeCondition({
			userId: params.userId,
			managed: Array.from(managed),
			unmanaged: params.organizationIds.filter(
				(organizationId) => !managed.has(organizationId),
			),
		});
	});

/** Whether the caller is an active member of one group. */
export const isActiveGroupMember = (params: {
	groupId: GroupId;
	userId: UserId;
}) =>
	Effect.gen(function* () {
		const db = yield* DB;

		const membership = yield* db.query.groupMember.findFirst({
			columns: {
				id: true,
			},
			where: {
				AND: [
					{
						groupId: {
							eq: params.groupId,
						},
					},
					{
						userId: {
							eq: params.userId,
						},
					},
					{
						removedAt: {
							isNull: true,
						},
					},
				],
			},
		});

		return membership != null;
	});
