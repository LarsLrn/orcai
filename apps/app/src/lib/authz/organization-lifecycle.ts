import {
	ORGANIZATION_ADMIN_ROLE,
	type OrganizationId,
	type UserId,
} from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { ALL_MEMBERS_GROUP_SYSTEM_KEY } from "@orcai/schema";
import { and, eq, getColumns, inArray, isNull } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { RelationshipFact } from "@/lib/authz/relationship-facts";
import {
	recordRelationshipFacts,
	writeRelationships,
} from "@/lib/authz/relationship-write";
import {
	grantPrincipal,
	scopedResourceRef,
} from "@/lib/authz/scoped-resource-id";
import * as AppErrors from "@/lib/effect/utils/errors";

/**
 * Inserts an organization with its first admin and its All Members group.
 * Call it in a {@link writeRelationships}; a new organization needs no lock.
 */
export const insertOrganization = (params: {
	values: Omit<typeof dbSchema.organization.$inferInsert, "createdAt">;
	adminUserId: UserId;
	now: Date;
}) =>
	Effect.gen(function* () {
		const db = yield* DB;

		const [organization] = yield* db
			.insert(dbSchema.organization)
			.values({
				...params.values,
				createdAt: params.now,
			})
			.returning({
				...getColumns(dbSchema.organization),
			});

		yield* db.insert(dbSchema.member).values({
			organizationId: organization.id,
			userId: params.adminUserId,
			role: ORGANIZATION_ADMIN_ROLE,
			createdAt: params.now,
		});

		const [allMembersGroup] = yield* db
			.insert(dbSchema.group)
			.values({
				organizationId: organization.id,
				name: "All Members",
				description: "System group containing all organisation members",
				kind: "system",
				systemKey: ALL_MEMBERS_GROUP_SYSTEM_KEY,
				createdBy: params.adminUserId,
				createdAt: params.now,
				updatedAt: params.now,
				deletedAt: null,
			})
			.returning({
				id: dbSchema.group.id,
			});

		yield* recordRelationshipFacts(
			RelationshipFact.OrganizationRoleChanged({
				organizationId: organization.id,
				userId: params.adminUserId,
				from: null,
				to: ORGANIZATION_ADMIN_ROLE,
			}),
			RelationshipFact.GroupCreated({
				groupId: allMembersGroup.id,
				organizationId: organization.id,
				allMembers: true,
			}),
		);

		return organization;
	});

/**
 * Deletes organizations with their memberships, groups and group grants, and
 * the tuples of all three. Resources scoped to them stay.
 */
export const deleteOrganizationsWithAuthorization = (
	organizationIds: readonly OrganizationId[],
) =>
	writeRelationships(
		{
			organizationIds,
		},
		Effect.gen(function* () {
			const db = yield* DB;
			const ids = [
				...organizationIds,
			];
			const now = new Date();

			const existing = yield* db
				.select({
					id: dbSchema.organization.id,
				})
				.from(dbSchema.organization)
				.where(inArray(dbSchema.organization.id, ids));

			if (existing.length !== new Set(ids).size) {
				return yield* Effect.fail(
					new AppErrors.NotFoundError({
						reason: "ORGANIZATION_NOT_FOUND",
						message: "One or more organizations were not found",
					}),
				);
			}

			const memberships = yield* db
				.select({
					organizationId: dbSchema.member.organizationId,
					userId: dbSchema.member.userId,
					role: dbSchema.member.role,
				})
				.from(dbSchema.member)
				.where(inArray(dbSchema.member.organizationId, ids));

			const groups = yield* db
				.select({
					id: dbSchema.group.id,
					organizationId: dbSchema.group.organizationId,
					systemKey: dbSchema.group.systemKey,
				})
				.from(dbSchema.group)
				.where(
					and(
						inArray(dbSchema.group.organizationId, ids),
						isNull(dbSchema.group.deletedAt),
					),
				);
			const groupIds = groups.map((group) => group.id);

			const groupMembers =
				groupIds.length === 0
					? []
					: yield* db
							.select({
								groupId: dbSchema.groupMember.groupId,
								userId: dbSchema.groupMember.userId,
							})
							.from(dbSchema.groupMember)
							.where(
								and(
									inArray(dbSchema.groupMember.groupId, groupIds),
									isNull(dbSchema.groupMember.removedAt),
								),
							);

			const groupGrants =
				groupIds.length === 0
					? []
					: yield* db
							.update(dbSchema.resourceGrant)
							.set({
								revokedAt: now,
							})
							.where(
								and(
									eq(dbSchema.resourceGrant.principalType, "group"),
									inArray(dbSchema.resourceGrant.principalId, groupIds),
									isNull(dbSchema.resourceGrant.revokedAt),
								),
							)
							.returning({
								resourceType: dbSchema.resourceGrant.resourceType,
								resourceId: dbSchema.resourceGrant.resourceId,
								role: dbSchema.resourceGrant.role,
								principalType: dbSchema.resourceGrant.principalType,
								principalId: dbSchema.resourceGrant.principalId,
							});

			yield* db
				.delete(dbSchema.organization)
				.where(inArray(dbSchema.organization.id, ids));

			yield* db
				.update(dbSchema.session)
				.set({
					activeOrganizationId: null,
				})
				.where(inArray(dbSchema.session.activeOrganizationId, ids));

			yield* recordRelationshipFacts(
				...memberships.map((membership) =>
					RelationshipFact.OrganizationRoleChanged({
						organizationId: membership.organizationId,
						userId: membership.userId,
						from: membership.role,
						to: null,
					}),
				),
				...groups.map((group) =>
					RelationshipFact.GroupDeleted({
						groupId: group.id,
						organizationId: group.organizationId,
						allMembers: group.systemKey === ALL_MEMBERS_GROUP_SYSTEM_KEY,
					}),
				),
				...groupMembers.map((groupMember) =>
					RelationshipFact.GroupMembershipChanged({
						groupId: groupMember.groupId,
						userId: groupMember.userId,
						member: false,
					}),
				),
				...groupGrants.map((grant) =>
					RelationshipFact.ResourceGrantChanged({
						resource: scopedResourceRef(grant),
						principal: grantPrincipal(grant),
						from: grant.role,
						to: null,
					}),
				),
			);
		}),
	);

/**
 * Touches the user's role tuples in the organizations they are a member of,
 * read under the organizations' locks so a concurrent removal stays last.
 */
export const touchOrganizationRoles = (params: {
	userId: UserId;
	organizationIds: readonly OrganizationId[];
}) =>
	writeRelationships(
		{
			organizationIds: params.organizationIds,
		},
		Effect.gen(function* () {
			const db = yield* DB;
			const memberships = yield* db
				.select({
					organizationId: dbSchema.member.organizationId,
					role: dbSchema.member.role,
				})
				.from(dbSchema.member)
				.where(
					and(
						eq(dbSchema.member.userId, params.userId),
						inArray(dbSchema.member.organizationId, [
							...params.organizationIds,
						]),
					),
				);
			yield* recordRelationshipFacts(
				...memberships.map((membership) =>
					RelationshipFact.OrganizationRoleChanged({
						organizationId: membership.organizationId,
						userId: params.userId,
						from: null,
						to: membership.role,
					}),
				),
			);
		}),
	);
