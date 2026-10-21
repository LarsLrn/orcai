import type { GroupId, OrganizationId, UserId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import type {
	GrantRejection,
	ResourceGrantRole,
	ResourceVisibility,
} from "@orcai/schema";
import { ALL_MEMBERS_GROUP_SYSTEM_KEY } from "@orcai/schema";
import { and, eq, inArray, isNull } from "drizzle-orm";
import * as Effect from "effect/Effect";
import {
	isActiveGroupMember,
	organizationsWithManageGroups,
} from "@/lib/authz/group-visibility";
import {
	type GrantPrincipal,
	RelationshipFact,
	type ResourceRef,
} from "@/lib/authz/relationship-facts";
import {
	recordRelationshipFacts,
	writeRelationships,
} from "@/lib/authz/relationship-write";
import {
	lockExistingResource,
	resourceOrganizations,
} from "@/lib/authz/resource-lifecycle";
import {
	grantPrincipal,
	scopedResourceRef,
} from "@/lib/authz/scoped-resource-id";
import * as AppErrors from "@/lib/effect/utils/errors";

type ActiveGrant = typeof dbSchema.resourceGrant.$inferSelect;

type Actor = {
	userId: UserId;
	zedToken: string | undefined;
};

const principalKey = (principal: {
	principalType: string;
	principalId: string;
}) => `${principal.principalType}:${principal.principalId}`;

/** The resource's grants that are not revoked. */
export const activeGrants = (resource: ResourceRef) =>
	Effect.gen(function* () {
		const db = yield* DB;
		return yield* db
			.select()
			.from(dbSchema.resourceGrant)
			.where(
				and(
					eq(dbSchema.resourceGrant.resourceType, resource.resourceType),
					eq(dbSchema.resourceGrant.resourceId, resource.resourceId),
					isNull(dbSchema.resourceGrant.revokedAt),
				),
			);
	});

/**
 * Fails when a resource with managers would end up with none. Only grant and
 * revoke apply it: the owner keeps `manage_access` either way, and a principal
 * that leaves is detached even when it was the last manager.
 */
const ensureManagerRemains = (
	active: readonly ActiveGrant[],
	change: (managers: Set<string>) => void,
) => {
	const before = new Set(
		active
			.filter((grant) => grant.role === "manager")
			.map((grant) => principalKey(grant)),
	);
	const after = new Set(before);
	change(after);

	return before.size > 0 && after.size === 0
		? Effect.fail(
				new AppErrors.BadRequestError({
					reason: "LAST_MANAGER_REQUIRED",
					message: "At least one manager must remain on this resource",
				}),
			)
		: Effect.void;
};

/**
 * Runs a change to one resource's access under its organizations' locks,
 * while the resource exists. `body` gets the organizations it is scoped to.
 */
const writeResourceAccess = <A, E, R>(
	resource: ResourceRef,
	body: (organizationIds: readonly OrganizationId[]) => Effect.Effect<A, E, R>,
) =>
	writeRelationships(
		{
			organizationIds: resourceOrganizations([
				resource,
			]),
		},
		Effect.gen(function* () {
			if (!(yield* lockExistingResource(resource)))
				return yield* Effect.fail(
					new AppErrors.NotFoundError({
						id: resource.resourceId,
						message: "Resource not found",
					}),
				);
			return yield* body(
				yield* resourceOrganizations([
					resource,
				]),
			);
		}),
	);

/**
 * Why each principal cannot receive `role` on a resource of `organizationIds`.
 * A user must be a member of one of them; a group must belong to one, All
 * Members only as viewer, and other groups only when the actor manages groups
 * there or is a member.
 */
const principalRejections = (params: {
	principals: readonly GrantPrincipal[];
	role: ResourceGrantRole;
	organizationIds: readonly OrganizationId[];
	managedOrganizations: ReadonlySet<OrganizationId>;
	actorId: UserId;
}) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const rejections: GrantRejection[] = [];

		for (const principal of params.principals) {
			if (principal.principalType === "user") {
				const [membership] = yield* db
					.select({
						userId: dbSchema.member.userId,
					})
					.from(dbSchema.member)
					.where(
						and(
							inArray(dbSchema.member.organizationId, [
								...params.organizationIds,
							]),
							eq(dbSchema.member.userId, principal.principalId),
						),
					)
					.limit(1);
				if (!membership)
					rejections.push({
						principalId: principal.principalId,
						reason: "USER_NOT_IN_SCOPE",
					});
				continue;
			}

			const [group] = yield* db
				.select({
					organizationId: dbSchema.group.organizationId,
					kind: dbSchema.group.kind,
					systemKey: dbSchema.group.systemKey,
				})
				.from(dbSchema.group)
				.where(
					and(
						eq(dbSchema.group.id, principal.principalId),
						inArray(dbSchema.group.organizationId, [
							...params.organizationIds,
						]),
						isNull(dbSchema.group.deletedAt),
					),
				);
			if (!group) {
				rejections.push({
					principalId: principal.principalId,
					reason: "GROUP_NOT_IN_SCOPE",
				});
				continue;
			}

			const isAllMembers =
				group.kind === "system" &&
				group.systemKey === ALL_MEMBERS_GROUP_SYSTEM_KEY;
			if (isAllMembers) {
				if (params.role !== "viewer")
					rejections.push({
						principalId: principal.principalId,
						reason: "ALL_MEMBERS_VIEWER_ONLY",
					});
				continue;
			}

			if (
				!params.managedOrganizations.has(group.organizationId) &&
				!(yield* isActiveGroupMember({
					groupId: principal.principalId,
					userId: params.actorId,
				}))
			)
				rejections.push({
					principalId: principal.principalId,
					reason: "GROUP_NOT_JOINED",
				});
		}

		return rejections;
	});

/**
 * Gives every principal `role` on the resource, replacing their current
 * grant. Principals are checked against the resource's organizations under
 * their locks, so a member removed or a group deleted concurrently is
 * rejected rather than granted.
 */
export const grantResourceAccess = (params: {
	resource: ResourceRef;
	principals: readonly GrantPrincipal[];
	role: ResourceGrantRole;
	actor: Actor;
}) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const now = new Date();
		const managedOrganizations = params.principals.some(
			(principal) => principal.principalType === "group",
		)
			? yield* organizationsWithManageGroups({
					organizationIds: yield* resourceOrganizations([
						params.resource,
					]),
					userId: params.actor.userId,
					zedToken: params.actor.zedToken,
				})
			: new Set<OrganizationId>();

		const { result: grants, zedToken } = yield* writeResourceAccess(
			params.resource,
			(organizationIds) =>
				Effect.gen(function* () {
					if (organizationIds.length === 0)
						return yield* Effect.fail(
							new AppErrors.BadRequestError({
								reason: "RESOURCE_SCOPE_REQUIRED",
								message:
									"Resource has no active organization scope and cannot be shared",
							}),
						);

					const rejections = yield* principalRejections({
						principals: params.principals,
						role: params.role,
						organizationIds,
						managedOrganizations,
						actorId: params.actor.userId,
					});
					if (rejections.length > 0)
						return yield* Effect.fail(
							new AppErrors.BadRequestError({
								reason: "GRANT_PRINCIPALS_INVALID",
								params: {
									rejections,
								},
								message: "Grant principals rejected",
							}),
						);

					const active = yield* activeGrants(params.resource);
					const existingByPrincipal = new Map(
						active.map((grant) => [
							principalKey(grant),
							grant,
						]),
					);

					yield* ensureManagerRemains(active, (managers) => {
						for (const principal of params.principals) {
							if (params.role === "manager") {
								managers.add(principalKey(principal));
							} else {
								managers.delete(principalKey(principal));
							}
						}
					});

					const written: ActiveGrant[] = [];
					for (const principal of params.principals) {
						const existing = existingByPrincipal.get(principalKey(principal));

						if (existing)
							yield* db
								.update(dbSchema.resourceGrant)
								.set({
									revokedAt: now,
								})
								.where(eq(dbSchema.resourceGrant.id, existing.id));

						const [grant] = yield* db
							.insert(dbSchema.resourceGrant)
							.values({
								...params.resource,
								...principal,
								role: params.role,
								grantedBy: params.actor.userId,
								createdAt: now,
								revokedAt: null,
							})
							.returning();
						written.push(grant);

						yield* recordRelationshipFacts(
							RelationshipFact.ResourceGrantChanged({
								resource: params.resource,
								principal,
								from: existing?.role ?? null,
								to: params.role,
							}),
						);
					}

					return written;
				}),
		);

		return {
			grants,
			zedToken,
		};
	});

/** Revokes the principal's grant on the resource; returns how many were active. */
export const revokeResourceAccess = (params: {
	resource: ResourceRef;
	principal: GrantPrincipal;
}) =>
	writeResourceAccess(params.resource, () =>
		Effect.gen(function* () {
			const db = yield* DB;
			const active = yield* activeGrants(params.resource);
			const revoked = active.filter(
				(grant) => principalKey(grant) === principalKey(params.principal),
			);
			if (revoked.length === 0) return 0;

			yield* ensureManagerRemains(active, (managers) => {
				managers.delete(principalKey(params.principal));
			});

			yield* db
				.update(dbSchema.resourceGrant)
				.set({
					revokedAt: new Date(),
				})
				.where(
					inArray(
						dbSchema.resourceGrant.id,
						revoked.map((grant) => grant.id),
					),
				);

			yield* recordRelationshipFacts(
				...revoked.map((grant) =>
					RelationshipFact.ResourceGrantChanged({
						resource: params.resource,
						principal: grantPrincipal(grant),
						from: grant.role,
						to: null,
					}),
				),
			);

			return revoked.length;
		}),
	).pipe(Effect.map(({ result }) => result));

export const setResourceVisibility = (params: {
	resource: ResourceRef;
	visibility: ResourceVisibility;
	actorId: UserId;
}) =>
	writeResourceAccess(params.resource, () =>
		Effect.gen(function* () {
			const db = yield* DB;
			const now = new Date();
			const [row] = yield* db
				.insert(dbSchema.resourceVisibility)
				.values({
					...params.resource,
					visibility: params.visibility,
					updatedBy: params.actorId,
					updatedAt: now,
				})
				.onConflictDoUpdate({
					target: [
						dbSchema.resourceVisibility.resourceType,
						dbSchema.resourceVisibility.resourceId,
					],
					set: {
						visibility: params.visibility,
						updatedAt: now,
						updatedBy: params.actorId,
					},
				})
				.returning();

			yield* recordRelationshipFacts(
				RelationshipFact.ResourceVisibilitySet({
					resource: params.resource,
					visibility: params.visibility,
				}),
			);

			return row;
		}),
	).pipe(Effect.map(({ result }) => result));

type UserGrant = {
	id: string;
	resourceType: "asset" | "block" | "bot";
	resourceId: string;
	role: ResourceGrantRole;
	principalId: UserId | GroupId;
};

const revokeGrants = (grants: readonly UserGrant[], now: Date) =>
	Effect.gen(function* () {
		if (grants.length === 0) return;
		const db = yield* DB;
		yield* db
			.update(dbSchema.resourceGrant)
			.set({
				revokedAt: now,
			})
			.where(
				inArray(
					dbSchema.resourceGrant.id,
					grants.map((grant) => grant.id),
				),
			);
	});

const recordRevokedUserGrants = (grants: readonly UserGrant[]) =>
	recordRelationshipFacts(
		...grants.map((grant) =>
			RelationshipFact.ResourceGrantChanged({
				resource: scopedResourceRef(grant),
				principal: {
					principalType: "user",
					principalId: grant.principalId as UserId,
				},
				from: grant.role,
				to: null,
			}),
		),
	);

/** Removes the users' active group memberships, in one organization's groups when given. */
const leaveGroups = (params: {
	organizationId?: OrganizationId;
	userIds: readonly UserId[];
	now: Date;
}) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const memberships = yield* db
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
		if (memberships.length === 0) return;

		yield* db
			.update(dbSchema.groupMember)
			.set({
				removedAt: params.now,
			})
			.where(
				inArray(
					dbSchema.groupMember.id,
					memberships.map((membership) => membership.id),
				),
			);
		yield* recordRelationshipFacts(
			...memberships.map((membership) =>
				RelationshipFact.GroupMembershipChanged({
					groupId: membership.groupId,
					userId: membership.userId,
					member: false,
				}),
			),
		);
	});

const scopeKey = (resource: { resourceType: string; resourceId: string }) =>
	`${resource.resourceType}:${resource.resourceId}`;

/**
 * Detaches users whose membership of the organization is gone: they leave its
 * groups and lose their direct grants on its resources, unless a remaining
 * membership of another organization the resource is scoped to keeps them in
 * reach. Call it in the {@link writeRelationships} that deletes the `member`
 * rows, after deleting them.
 */
export const detachMembers = (params: {
	organizationId: OrganizationId;
	userIds: readonly UserId[];
	now: Date;
}) =>
	Effect.gen(function* () {
		if (params.userIds.length === 0) return;
		const db = yield* DB;

		yield* leaveGroups(params);

		const candidates = yield* db
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
		if (candidates.length === 0) return;

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
		const otherScopes = yield* db
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
						candidates.map((grant) => grant.resourceId),
					),
					isNull(dbSchema.resourceScope.endedAt),
				),
			);

		const reachable = new Set(
			otherScopes.flatMap((scope) =>
				remainingMemberships
					.filter(
						(membership) => membership.organizationId === scope.organizationId,
					)
					.map((membership) => `${scopeKey(scope)}@${membership.userId}`),
			),
		);
		const revoked = candidates.filter(
			(grant) => !reachable.has(`${scopeKey(grant)}@${grant.principalId}`),
		);

		yield* revokeGrants(revoked, params.now);
		yield* recordRevokedUserGrants(revoked);
	});

/**
 * Detaches accounts being deleted: they leave every group and lose every
 * direct grant. Lock {@link accountAccessOrganizations} for them.
 */
export const detachAccounts = (params: {
	userIds: readonly UserId[];
	now: Date;
}) =>
	Effect.gen(function* () {
		if (params.userIds.length === 0) return;
		const db = yield* DB;

		yield* leaveGroups(params);

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

		yield* revokeGrants(grants, params.now);
		yield* recordRevokedUserGrants(grants);
	});

/**
 * The organizations whose locks guard the users' grants and group
 * memberships, including those where they hold a grant without a membership.
 */
export const accountAccessOrganizations = (userIds: readonly UserId[]) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const [grantScopes, groups] = yield* Effect.all([
			db
				.selectDistinct({
					organizationId: dbSchema.resourceScope.organizationId,
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
							...userIds,
						]),
						isNull(dbSchema.resourceGrant.revokedAt),
						isNull(dbSchema.resourceScope.endedAt),
					),
				),
			db
				.selectDistinct({
					organizationId: dbSchema.group.organizationId,
				})
				.from(dbSchema.groupMember)
				.innerJoin(
					dbSchema.group,
					eq(dbSchema.group.id, dbSchema.groupMember.groupId),
				)
				.where(
					and(
						inArray(dbSchema.groupMember.userId, [
							...userIds,
						]),
						isNull(dbSchema.groupMember.removedAt),
					),
				),
		]);
		return [
			...grantScopes,
			...groups,
		].map((row) => row.organizationId);
	});

/**
 * Revokes every grant the groups hold. Call it in the {@link writeRelationships}
 * that deletes them, under their organizations' locks.
 */
export const detachGroups = (params: {
	groupIds: readonly GroupId[];
	now: Date;
}) =>
	Effect.gen(function* () {
		if (params.groupIds.length === 0) return;
		const db = yield* DB;
		const revoked = yield* db
			.update(dbSchema.resourceGrant)
			.set({
				revokedAt: params.now,
			})
			.where(
				and(
					eq(dbSchema.resourceGrant.principalType, "group"),
					inArray(dbSchema.resourceGrant.principalId, [
						...params.groupIds,
					]),
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

		yield* recordRelationshipFacts(
			...revoked.map((grant) =>
				RelationshipFact.ResourceGrantChanged({
					resource: scopedResourceRef(grant),
					principal: grantPrincipal(grant),
					from: grant.role,
					to: null,
				}),
			),
		);
	});
