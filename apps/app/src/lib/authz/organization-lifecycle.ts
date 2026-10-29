import {
	ORGANIZATION_ADMIN_ROLE,
	type OrganizationId,
	type UserId,
} from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { ALL_MEMBERS_GROUP_SYSTEM_KEY, RESOURCE_TYPES } from "@orcai/schema";
import { and, asc, eq, getColumns, inArray, isNull } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { RelationshipFact } from "@/lib/authz/relationship-facts";
import {
	recordRelationshipFacts,
	writeRelationships,
} from "@/lib/authz/relationship-write";
import {
	detachGroups,
	detachMembers,
	issuedGrantOrganizations,
} from "@/lib/authz/resource-access";
import {
	deleteResources,
	removeDeletedResourceData,
	resourceOrganizations,
} from "@/lib/authz/resource-lifecycle";
import * as AppErrors from "@/lib/effect/utils/errors";
import { deleteImages } from "@/lib/images/images";

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

/** The bots, blocks and assets whose home is one of the organizations. */
const homeResources = (organizationIds: readonly OrganizationId[]) =>
	Effect.gen(function* () {
		const db = yield* DB;
		return yield* db
			.select({
				resourceType: dbSchema.resourceScope.resourceType,
				resourceId: dbSchema.resourceScope.resourceId,
			})
			.from(dbSchema.resourceScope)
			.where(
				and(
					inArray(dbSchema.resourceScope.organizationId, [
						...organizationIds,
					]),
					eq(dbSchema.resourceScope.isPrimary, true),
					isNull(dbSchema.resourceScope.endedAt),
				),
			);
	});

/**
 * Deletes organizations with the resources they are home to, their
 * memberships, groups and grants, and the tuples of all of them. Members are
 * detached as when they are removed.
 */
export const deleteOrganizationsWithAuthorization = (
	organizationIds: readonly OrganizationId[],
) =>
	writeRelationships(
		{
			organizationIds: Effect.all([
				homeResources(organizationIds).pipe(
					Effect.flatMap(resourceOrganizations),
				),
				issuedGrantOrganizations({
					organizationIds,
				}),
			]).pipe(Effect.map((locked) => locked.flat())),
		},
		Effect.gen(function* () {
			const db = yield* DB;
			const ids = [
				...organizationIds,
			];
			const now = new Date();

			// The lock keeps a logo commit from landing on a deleted organisation.
			const existing = yield* db
				.select({
					id: dbSchema.organization.id,
					logo: dbSchema.organization.logo,
				})
				.from(dbSchema.organization)
				.where(inArray(dbSchema.organization.id, ids))
				.orderBy(asc(dbSchema.organization.id))
				.for("update");

			if (existing.length !== new Set(ids).size) {
				return yield* Effect.fail(
					new AppErrors.NotFoundError({
						reason: "ORGANIZATION_NOT_FOUND",
						message: "One or more organizations were not found",
					}),
				);
			}

			const resources = yield* homeResources(ids);
			const deleted = yield* Effect.forEach(RESOURCE_TYPES, (resourceType) =>
				deleteResources({
					resourceType,
					resourceIds: resources
						.filter((resource) => resource.resourceType === resourceType)
						.map((resource) => resource.resourceId),
				}),
			);

			const memberships = yield* db
				.delete(dbSchema.member)
				.where(inArray(dbSchema.member.organizationId, ids))
				.returning({
					organizationId: dbSchema.member.organizationId,
					userId: dbSchema.member.userId,
					role: dbSchema.member.role,
				});
			yield* recordRelationshipFacts(
				...memberships.map((membership) =>
					RelationshipFact.OrganizationRoleChanged({
						organizationId: membership.organizationId,
						userId: membership.userId,
						from: membership.role,
						to: null,
					}),
				),
			);
			for (const organizationId of ids)
				yield* detachMembers({
					organizationId,
					userIds: memberships
						.filter(
							(membership) => membership.organizationId === organizationId,
						)
						.map((membership) => membership.userId),
					now,
				});

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
			yield* detachGroups({
				groupIds,
				now,
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
			);
			return {
				logos: existing.map((organization) => organization.logo),
				deleted,
			};
		}),
	).pipe(
		Effect.flatMap(({ result }) =>
			Effect.all(
				[
					deleteImages(result.logos),
					removeDeletedResourceData(result.deleted),
				],
				{
					discard: true,
				},
			),
		),
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
