import type { OrganizationId, UserId } from "@orcai/core";
import { dbSchema } from "@orcai/db";
import { ALL_MEMBERS_GROUP_SYSTEM_KEY } from "@orcai/schema";
import type { ReadRevision } from "@orcai/spice-db";
import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { QueryBuilder } from "drizzle-orm/pg-core";
import * as Effect from "effect/Effect";
import {
	organizationPermitted,
	permittedOrganizationIds,
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
	permittedOrganizationIds({
		organizationIds: params.organizationIds,
		userId: params.userId,
		permission: "manage_groups",
		zedToken: params.zedToken ?? undefined,
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
