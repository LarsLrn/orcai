import type { GroupId, OrganizationId, UserId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { ALL_MEMBERS_GROUP_SYSTEM_KEY } from "@orcai/schema";
import { checkEntityPermission, hasPermission } from "@orcai/spice-db";
import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { QueryBuilder } from "drizzle-orm/pg-core";
import * as Effect from "effect/Effect";

type PermissionParams = {
	userId: UserId;
	zedToken?: string | null | undefined;
};

/** Whether the caller manages the groups of one organisation. */
export const hasManageGroups = (
	params: PermissionParams & {
		organizationId: OrganizationId;
	},
) =>
	checkEntityPermission({
		entityType: "organization",
		entityId: params.organizationId,
		permission: "manage_groups",
		userId: params.userId,
		zedToken: params.zedToken,
	}).pipe(Effect.map(hasPermission));

const organizationsWithManageGroups = (
	params: PermissionParams & {
		organizationIds: readonly OrganizationId[];
	},
) =>
	Effect.all(
		params.organizationIds.map((organizationId) =>
			hasManageGroups({
				...params,
				organizationId,
			}).pipe(
				Effect.map((allowed) => ({
					organizationId,
					allowed,
				})),
			),
		),
		{
			concurrency: "unbounded",
		},
	).pipe(
		Effect.map(
			(results) =>
				new Set(
					results
						.filter((result) => result.allowed)
						.map((result) => result.organizationId),
				),
		),
	);

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
