import type { GroupId, OrganizationId, UserId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import type { GrantRejection, ResourceGrantRole } from "@orcai/schema";
import { ALL_MEMBERS_GROUP_SYSTEM_KEY } from "@orcai/schema";
import { and, eq, inArray, isNull, type SQL } from "drizzle-orm";
import * as Arr from "effect/Array";
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
import { requireAdministersIn } from "@/lib/authz/resource-authority";
import {
	lockExistingResource,
	resourceOrganizations,
	scopeIn,
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

/** The resource's grants issued in the organisation that are not revoked. */
export const activeGrants = (
	resource: ResourceRef,
	organizationId: OrganizationId,
) =>
	Effect.gen(function* () {
		const db = yield* DB;
		return yield* db
			.select()
			.from(dbSchema.resourceGrant)
			.where(
				and(
					eq(dbSchema.resourceGrant.resourceType, resource.resourceType),
					eq(dbSchema.resourceGrant.resourceId, resource.resourceId),
					eq(dbSchema.resourceGrant.organizationId, organizationId),
					isNull(dbSchema.resourceGrant.revokedAt),
				),
			);
	});

type EndedGrant = {
	resourceType: ResourceRef["resourceType"];
	resourceId: string;
	principalType: GrantPrincipal["principalType"];
	principalId: UserId | GroupId;
	role: ResourceGrantRole;
};

/**
 * Records the tuples of principals whose grants changed: a role's tuple goes
 * only when no active grant, from any organisation, still backs it. `ended`
 * are the grants that ended; `touched` principals gained one.
 */
export const recordGrantChanges = (
	ended: readonly EndedGrant[],
	touched: readonly EndedGrant[] = [],
) =>
	Effect.gen(function* () {
		const changed = [
			...ended,
			...touched,
		];
		if (changed.length === 0) return;
		const db = yield* DB;
		const keyOf = (grant: Omit<EndedGrant, "role">) =>
			`${scopeKey(grant)}@${principalKey(grant)}`;

		const held = yield* db
			.select({
				resourceType: dbSchema.resourceGrant.resourceType,
				resourceId: dbSchema.resourceGrant.resourceId,
				principalType: dbSchema.resourceGrant.principalType,
				principalId: dbSchema.resourceGrant.principalId,
				role: dbSchema.resourceGrant.role,
			})
			.from(dbSchema.resourceGrant)
			.where(
				and(
					inArray(
						dbSchema.resourceGrant.resourceId,
						Arr.dedupe(changed.map((grant) => grant.resourceId)),
					),
					inArray(
						dbSchema.resourceGrant.principalId,
						Arr.dedupe(changed.map((grant) => grant.principalId)),
					),
					isNull(dbSchema.resourceGrant.revokedAt),
				),
			);
		const heldRoles = Arr.groupBy(held, keyOf);
		const endedRoles = Arr.groupBy(ended, keyOf);

		yield* recordRelationshipFacts(
			...Arr.dedupeWith(changed, (a, b) => keyOf(a) === keyOf(b)).map((grant) =>
				RelationshipFact.ResourceGrantChanged({
					resource: scopedResourceRef(grant),
					principal: grantPrincipal(grant),
					ended: (endedRoles[keyOf(grant)] ?? []).map((row) => row.role),
					held: (heldRoles[keyOf(grant)] ?? []).map((row) => row.role),
				}),
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
 * grant issued in the organisation. The actor must administer the resource
 * there, and principals must belong to it, both checked under the resource's
 * locks, so a demotion, a member removed or a group deleted concurrently is
 * rejected rather than granted.
 */
export const grantResourceAccess = (params: {
	resource: ResourceRef;
	organizationId: OrganizationId;
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
					organizationIds: [
						params.organizationId,
					],
					userId: params.actor.userId,
					zedToken: params.actor.zedToken,
				})
			: new Set<OrganizationId>();

		const { result: grants, zedToken } = yield* writeResourceAccess(
			params.resource,
			(organizationIds) =>
				Effect.gen(function* () {
					if (!organizationIds.includes(params.organizationId))
						return yield* Effect.fail(
							new AppErrors.BadRequestError({
								reason: "RESOURCE_SCOPE_REQUIRED",
								message:
									"Resource is not available in this organization and cannot be shared here",
							}),
						);

					yield* requireAdministersIn({
						resource: params.resource,
						organizationId: params.organizationId,
						homePermission: "manage_access",
						actor: params.actor,
					});

					if (
						params.role !== "viewer" &&
						(yield* scopeIn(params.resource, params.organizationId)) ===
							"install"
					)
						return yield* Effect.fail(
							new AppErrors.BadRequestError({
								reason: "INSTALL_GRANTS_VIEWER_ONLY",
								message:
									"Resources added from the catalogue can be shared for use only, not for editing or managing.",
							}),
						);

					const rejections = yield* principalRejections({
						principals: params.principals,
						role: params.role,
						organizationIds: [
							params.organizationId,
						],
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

					const active = yield* activeGrants(
						params.resource,
						params.organizationId,
					);
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
					const replaced: ActiveGrant[] = [];
					for (const principal of params.principals) {
						const existing = existingByPrincipal.get(principalKey(principal));

						if (existing) {
							yield* db
								.update(dbSchema.resourceGrant)
								.set({
									revokedAt: now,
								})
								.where(eq(dbSchema.resourceGrant.id, existing.id));
							replaced.push(existing);
						}

						const [grant] = yield* db
							.insert(dbSchema.resourceGrant)
							.values({
								...params.resource,
								...principal,
								role: params.role,
								organizationId: params.organizationId,
								grantedBy: params.actor.userId,
								createdAt: now,
								revokedAt: null,
							})
							.returning();
						written.push(grant);
					}
					yield* recordGrantChanges(replaced, written);

					return written;
				}),
		);

		return {
			grants,
			zedToken,
		};
	});

/**
 * Revokes the principal's grant on the resource issued in the organisation,
 * when the actor administers the resource there; returns how many were active.
 */
export const revokeResourceAccess = (params: {
	resource: ResourceRef;
	organizationId: OrganizationId;
	principal: GrantPrincipal;
	actor: Actor;
}) =>
	writeResourceAccess(params.resource, () =>
		Effect.gen(function* () {
			yield* requireAdministersIn({
				resource: params.resource,
				organizationId: params.organizationId,
				homePermission: "manage_access",
				actor: params.actor,
			});
			const db = yield* DB;
			const active = yield* activeGrants(
				params.resource,
				params.organizationId,
			);
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

			yield* recordGrantChanges(revoked);

			return revoked.length;
		}),
	).pipe(Effect.map(({ result }) => result));

const grantColumns = {
	id: dbSchema.resourceGrant.id,
	resourceType: dbSchema.resourceGrant.resourceType,
	resourceId: dbSchema.resourceGrant.resourceId,
	principalType: dbSchema.resourceGrant.principalType,
	principalId: dbSchema.resourceGrant.principalId,
	role: dbSchema.resourceGrant.role,
};

/** Revokes the grants matching `where` and records their tuples. */
const revokeGrantsWhere = (where: SQL | undefined, now: Date) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const revoked = yield* db
			.update(dbSchema.resourceGrant)
			.set({
				revokedAt: now,
			})
			.where(and(isNull(dbSchema.resourceGrant.revokedAt), where))
			.returning(grantColumns);
		yield* recordGrantChanges(revoked);
	});

/**
 * Revokes the resource's grants issued in the organisations. Call it in a
 * {@link writeRelationships} that holds the resource's organisation locks.
 */
export const revokeIssuedGrants = (params: {
	resource: ResourceRef;
	organizationIds: readonly OrganizationId[];
	now: Date;
}) =>
	params.organizationIds.length === 0
		? Effect.void
		: revokeGrantsWhere(
				and(
					eq(dbSchema.resourceGrant.resourceType, params.resource.resourceType),
					eq(dbSchema.resourceGrant.resourceId, params.resource.resourceId),
					inArray(dbSchema.resourceGrant.organizationId, [
						...params.organizationIds,
					]),
				),
				params.now,
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
 * The organizations whose locks guard the user grants issued in
 * `organizationIds`, to `userIds` or to anyone: the issuing ones and every
 * scope of the granted resources, where grants from other organizations may
 * back the same tuples.
 */
export const issuedGrantOrganizations = (params: {
	organizationIds: readonly OrganizationId[];
	userIds?: readonly UserId[];
}) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const scopes = yield* db
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
					inArray(dbSchema.resourceGrant.organizationId, [
						...params.organizationIds,
					]),
					eq(dbSchema.resourceGrant.principalType, "user"),
					params.userIds
						? inArray(dbSchema.resourceGrant.principalId, [
								...params.userIds,
							])
						: undefined,
					isNull(dbSchema.resourceGrant.revokedAt),
					isNull(dbSchema.resourceScope.endedAt),
				),
			);
		return Arr.dedupe([
			...params.organizationIds,
			...scopes.map((scope) => scope.organizationId),
		]);
	});

/**
 * Detaches users whose membership of the organization is gone: they leave its
 * groups and lose the direct grants issued in it. Call it in the
 * {@link writeRelationships} that deletes the `member` rows, after deleting
 * them, holding {@link issuedGrantOrganizations}.
 */
export const detachMembers = (params: {
	organizationId: OrganizationId;
	userIds: readonly UserId[];
	now: Date;
}) =>
	Effect.gen(function* () {
		if (params.userIds.length === 0) return;
		yield* leaveGroups(params);
		yield* revokeGrantsWhere(
			and(
				eq(dbSchema.resourceGrant.organizationId, params.organizationId),
				eq(dbSchema.resourceGrant.principalType, "user"),
				inArray(dbSchema.resourceGrant.principalId, [
					...params.userIds,
				]),
			),
			params.now,
		);
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
		yield* leaveGroups(params);
		yield* revokeGrantsWhere(
			and(
				eq(dbSchema.resourceGrant.principalType, "user"),
				inArray(dbSchema.resourceGrant.principalId, [
					...params.userIds,
				]),
			),
			params.now,
		);
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
					organizationId: dbSchema.resourceGrant.organizationId,
				})
				.from(dbSchema.resourceGrant)
				.where(
					and(
						eq(dbSchema.resourceGrant.principalType, "user"),
						inArray(dbSchema.resourceGrant.principalId, [
							...userIds,
						]),
						isNull(dbSchema.resourceGrant.revokedAt),
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
		yield* revokeGrantsWhere(
			and(
				eq(dbSchema.resourceGrant.principalType, "group"),
				inArray(dbSchema.resourceGrant.principalId, [
					...params.groupIds,
				]),
			),
			params.now,
		);
	});
