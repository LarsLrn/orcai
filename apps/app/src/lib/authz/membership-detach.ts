import type { GroupId, OrganizationId, UserId } from "@orcai/core";
import { type DB, dbSchema } from "@orcai/db";
import type { TupleMutation } from "@orcai/spice-db";
import { and, eq, inArray, isNull } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { parseScopedResourceId } from "@/lib/orpc/router/helpers/scoped-resource-id";

type TransactionLike = {
	select: typeof DB.Service.select;
	update: typeof DB.Service.update;
};

type GrantRow = {
	id: string;
	resourceType: "asset" | "block" | "bot";
	resourceId: string;
	role: "viewer" | "editor" | "manager";
	principalId: UserId | GroupId;
};

const groupMemberDeletions = (
	rows: readonly {
		groupId: (typeof dbSchema.groupMember.$inferSelect)["groupId"];
		userId: UserId;
	}[],
): TupleMutation[] =>
	rows.map((row) => ({
		resourceType: "group" as const,
		resourceId: row.groupId,
		relation: "member" as const,
		subjectType: "user" as const,
		subjectId: row.userId,
		operation: "delete" as const,
	}));

const grantDeletions = (rows: readonly GrantRow[]): TupleMutation[] =>
	rows.map((row) => ({
		resourceType: row.resourceType,
		resourceId: parseScopedResourceId(row),
		relation: row.role,
		subjectType: "user" as const,
		subjectId: row.principalId as UserId,
		operation: "delete" as const,
	}));

const activeGroupMemberships = (params: {
	tx: TransactionLike;
	organizationId?: OrganizationId;
	userIds: readonly UserId[];
}) =>
	params.tx
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

const removeGroupMemberships = (params: {
	tx: TransactionLike;
	ids: readonly (typeof dbSchema.groupMember.$inferSelect)["id"][];
	now: Date;
}) =>
	Effect.gen(function* () {
		if (params.ids.length === 0) {
			return;
		}

		yield* params.tx
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
	tx: TransactionLike;
	ids: readonly (typeof dbSchema.resourceGrant.$inferSelect)["id"][];
	now: Date;
}) =>
	Effect.gen(function* () {
		if (params.ids.length === 0) {
			return;
		}

		yield* params.tx
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
 * Returns the SpiceDB deletions for the caller to apply after the commit.
 */
export const detachOrganizationAccess = (params: {
	tx: TransactionLike;
	organizationId: OrganizationId;
	userIds: readonly UserId[];
	now: Date;
}) =>
	Effect.gen(function* () {
		if (params.userIds.length === 0) {
			return [] as TupleMutation[];
		}

		const groupMemberships = yield* activeGroupMemberships({
			tx: params.tx,
			organizationId: params.organizationId,
			userIds: params.userIds,
		});

		yield* removeGroupMemberships({
			tx: params.tx,
			ids: groupMemberships.map((membership) => membership.id),
			now: params.now,
		});

		const scopedGrants = yield* params.tx
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
			return groupMemberDeletions(groupMemberships);
		}

		const remainingMemberships = yield* params.tx
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

		const activeScopes = yield* params.tx
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
			tx: params.tx,
			ids: revoked.map((grant) => grant.id),
			now: params.now,
		});

		return [
			...groupMemberDeletions(groupMemberships),
			...grantDeletions(revoked),
		];
	});

/**
 * Remove every group membership and direct grant of accounts being deleted.
 * Returns the SpiceDB deletions for the caller to apply after the commit.
 */
export const detachAccountAccess = (params: {
	tx: TransactionLike;
	userIds: readonly UserId[];
	now: Date;
}) =>
	Effect.gen(function* () {
		if (params.userIds.length === 0) {
			return [] as TupleMutation[];
		}

		const groupMemberships = yield* activeGroupMemberships({
			tx: params.tx,
			userIds: params.userIds,
		});

		yield* removeGroupMemberships({
			tx: params.tx,
			ids: groupMemberships.map((membership) => membership.id),
			now: params.now,
		});

		const grants = yield* params.tx
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
			tx: params.tx,
			ids: grants.map((grant) => grant.id),
			now: params.now,
		});

		return [
			...groupMemberDeletions(groupMemberships),
			...grantDeletions(grants),
		];
	});
