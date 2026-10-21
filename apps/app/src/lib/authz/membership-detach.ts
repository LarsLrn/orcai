import type { GroupId, OrganizationId, UserId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { and, eq, inArray, isNull } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { RelationshipFact } from "@/lib/authz/relationship-facts";
import { recordRelationshipFacts } from "@/lib/authz/relationship-write";
import { scopedResourceRef } from "@/lib/authz/scoped-resource-id";

type GrantRow = {
	id: string;
	resourceType: "asset" | "block" | "bot";
	resourceId: string;
	role: "viewer" | "editor" | "manager";
	principalId: UserId | GroupId;
};

const recordDetached = (params: {
	groupMemberships: readonly {
		groupId: GroupId;
		userId: UserId;
	}[];
	grants: readonly GrantRow[];
}) =>
	recordRelationshipFacts(
		...params.groupMemberships.map((row) =>
			RelationshipFact.GroupMembershipChanged({
				groupId: row.groupId,
				userId: row.userId,
				member: false,
			}),
		),
		...params.grants.map((row) =>
			RelationshipFact.ResourceGrantChanged({
				resource: scopedResourceRef(row),
				principal: {
					principalType: "user",
					principalId: row.principalId as UserId,
				},
				from: row.role,
				to: null,
			}),
		),
	);

const activeGroupMemberships = (params: {
	organizationId?: OrganizationId;
	userIds: readonly UserId[];
}) =>
	Effect.gen(function* () {
		const db = yield* DB;
		return yield* db
			.select({
				id: dbSchema.groupMember.id,
				groupId: dbSchema.groupMember.groupId,
				userId: dbSchema.groupMember.userId,
			})
			.from(dbSchema.groupMember)
			.innerJoin(
				dbSchema.group,
				eq(dbSchema.group.id, dbSchema.groupMember.groupId),
			)
			.where(
				and(
					inArray(dbSchema.groupMember.userId, [
						...params.userIds,
					]),
					isNull(dbSchema.groupMember.removedAt),
					isNull(dbSchema.group.deletedAt),
					params.organizationId
						? eq(dbSchema.group.organizationId, params.organizationId)
						: undefined,
				),
			);
	});

const removeGroupMemberships = (params: {
	ids: readonly (typeof dbSchema.groupMember.$inferSelect)["id"][];
	now: Date;
}) =>
	Effect.gen(function* () {
		if (params.ids.length === 0) {
			return;
		}

		const db = yield* DB;
		yield* db
			.update(dbSchema.groupMember)
			.set({
				removedAt: params.now,
			})
			.where(
				inArray(dbSchema.groupMember.id, [
					...params.ids,
				]),
			);
	});

const revokeGrants = (params: {
	ids: readonly (typeof dbSchema.resourceGrant.$inferSelect)["id"][];
	now: Date;
}) =>
	Effect.gen(function* () {
		if (params.ids.length === 0) {
			return;
		}

		const db = yield* DB;
		yield* db
			.update(dbSchema.resourceGrant)
			.set({
				revokedAt: params.now,
			})
			.where(
				inArray(dbSchema.resourceGrant.id, [
					...params.ids,
				]),
			);
	});

const scopeKey = (resource: { resourceType: string; resourceId: string }) =>
	`${resource.resourceType}:${resource.resourceId}`;

/**
 * Remove the users' group memberships and direct grants in one organisation,
 * after their `member` rows are gone. Keep direct grants when another remaining
 * organisation membership still provides access to the resource.
 */
export const detachOrganizationAccess = (params: {
	organizationId: OrganizationId;
	userIds: readonly UserId[];
	now: Date;
}) =>
	Effect.gen(function* () {
		if (params.userIds.length === 0) {
			return;
		}

		const db = yield* DB;

		const groupMemberships = yield* activeGroupMemberships({
			organizationId: params.organizationId,
			userIds: params.userIds,
		});

		yield* removeGroupMemberships({
			ids: groupMemberships.map((membership) => membership.id),
			now: params.now,
		});

		const scopedGrants = yield* db
			.select({
				id: dbSchema.resourceGrant.id,
				resourceType: dbSchema.resourceGrant.resourceType,
				resourceId: dbSchema.resourceGrant.resourceId,
				role: dbSchema.resourceGrant.role,
				principalId: dbSchema.resourceGrant.principalId,
			})
			.from(dbSchema.resourceGrant)
			.innerJoin(
				dbSchema.resourceScope,
				and(
					eq(
						dbSchema.resourceScope.resourceType,
						dbSchema.resourceGrant.resourceType,
					),
					eq(
						dbSchema.resourceScope.resourceId,
						dbSchema.resourceGrant.resourceId,
					),
				),
			)
			.where(
				and(
					eq(dbSchema.resourceGrant.principalType, "user"),
					inArray(dbSchema.resourceGrant.principalId, [
						...params.userIds,
					]),
					isNull(dbSchema.resourceGrant.revokedAt),
					eq(dbSchema.resourceScope.organizationId, params.organizationId),
					isNull(dbSchema.resourceScope.endedAt),
				),
			);

		const candidates = new Map<string, GrantRow>();
		for (const grant of scopedGrants) {
			candidates.set(grant.id, grant);
		}

		if (candidates.size === 0) {
			return yield* recordDetached({
				groupMemberships,
				grants: [],
			});
		}

		const remainingMemberships = yield* db
			.select({
				userId: dbSchema.member.userId,
				organizationId: dbSchema.member.organizationId,
			})
			.from(dbSchema.member)
			.where(
				inArray(dbSchema.member.userId, [
					...params.userIds,
				]),
			);

		const organizationsByUser = new Map<
			UserId | GroupId,
			Set<OrganizationId>
		>();
		for (const membership of remainingMemberships) {
			const bucket =
				organizationsByUser.get(membership.userId) ?? new Set<OrganizationId>();
			bucket.add(membership.organizationId);
			organizationsByUser.set(membership.userId, bucket);
		}

		const activeScopes = yield* db
			.select({
				resourceType: dbSchema.resourceScope.resourceType,
				resourceId: dbSchema.resourceScope.resourceId,
				organizationId: dbSchema.resourceScope.organizationId,
			})
			.from(dbSchema.resourceScope)
			.where(
				and(
					inArray(
						dbSchema.resourceScope.resourceId,
						Array.from(candidates.values(), (grant) => grant.resourceId),
					),
					isNull(dbSchema.resourceScope.endedAt),
				),
			);

		const organizationsByResource = new Map<string, Set<OrganizationId>>();
		for (const scope of activeScopes) {
			const key = scopeKey(scope);
			const bucket =
				organizationsByResource.get(key) ?? new Set<OrganizationId>();
			bucket.add(scope.organizationId);
			organizationsByResource.set(key, bucket);
		}

		const revoked = Array.from(candidates.values()).filter((grant) => {
			const userOrganizations = organizationsByUser.get(grant.principalId);
			if (!userOrganizations || userOrganizations.size === 0) {
				return true;
			}

			const resourceOrganizations = organizationsByResource.get(
				scopeKey(grant),
			);
			if (!resourceOrganizations) {
				return true;
			}

			for (const organizationId of resourceOrganizations) {
				if (userOrganizations.has(organizationId)) {
					return false;
				}
			}

			return true;
		});

		yield* revokeGrants({
			ids: revoked.map((grant) => grant.id),
			now: params.now,
		});

		yield* recordDetached({
			groupMemberships,
			grants: revoked,
		});
	});

/**
 * Remove every group membership and direct grant of accounts being deleted.
 */
export const detachAccountAccess = (params: {
	userIds: readonly UserId[];
	now: Date;
}) =>
	Effect.gen(function* () {
		if (params.userIds.length === 0) {
			return;
		}

		const db = yield* DB;

		const groupMemberships = yield* activeGroupMemberships({
			userIds: params.userIds,
		});

		yield* removeGroupMemberships({
			ids: groupMemberships.map((membership) => membership.id),
			now: params.now,
		});

		const grants = yield* db
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
					eq(dbSchema.resourceGrant.principalType, "user"),
					inArray(dbSchema.resourceGrant.principalId, [
						...params.userIds,
					]),
					isNull(dbSchema.resourceGrant.revokedAt),
				),
			);

		yield* revokeGrants({
			ids: grants.map((grant) => grant.id),
			now: params.now,
		});

		yield* recordDetached({
			groupMemberships,
			grants,
		});
	});
