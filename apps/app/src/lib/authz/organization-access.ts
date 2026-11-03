import {
	ORGANIZATION_ROLE_PERMISSIONS,
	type OrganizationId,
	type OrganizationPermission,
	type OrganizationRole,
	type UserId,
} from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { organizationIdSchema, userIdSchema } from "@orcai/schema";
import {
	NEWEST_REVISION,
	permittedEntityIds,
	type ReadRevision,
} from "@orcai/spice-db";
import { and, eq, inArray } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { permissionDenied } from "@/lib/authz/permission-denied";
import * as AppErrors from "@/lib/effect/utils/errors";

/** Whether the role holds the permission; every organisation permission derives from a role. */
export const roleGrants = (
	role: OrganizationRole,
	permission: OrganizationPermission,
) =>
	(
		ORGANIZATION_ROLE_PERMISSIONS[role] as readonly OrganizationPermission[]
	).includes(permission);

/** The user's committed role in each of the organisations they are a member of. */
export const committedRoles = (params: {
	userId: UserId;
	organizationIds: readonly OrganizationId[];
}) =>
	Effect.gen(function* () {
		if (params.organizationIds.length === 0)
			return new Map<OrganizationId, OrganizationRole>();
		const rows = yield* (yield* DB)
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
		return new Map(
			rows.map((row) => [
				row.organizationId,
				row.role,
			]),
		);
	});

/**
 * The session's active organisation while the user is still a member there.
 * One they left is cleared, so they choose another.
 */
export const currentActiveOrganization = (session: {
	id: string;
	userId: string;
	activeOrganizationId?: string | null;
}) =>
	Effect.gen(function* () {
		if (!session.activeOrganizationId) return null;
		const organizationId = organizationIdSchema.parse(
			session.activeOrganizationId,
		);
		const roles = yield* committedRoles({
			userId: userIdSchema.parse(session.userId),
			organizationIds: [
				organizationId,
			],
		});
		if (roles.has(organizationId)) return organizationId;
		yield* (yield* DB)
			.update(dbSchema.session)
			.set({
				activeOrganizationId: null,
			})
			.where(
				and(
					eq(dbSchema.session.id, session.id),
					eq(dbSchema.session.activeOrganizationId, organizationId),
				),
			);
		return null;
	});

type AccessParams = {
	organizationId: OrganizationId;
	userId: UserId;
	permission: OrganizationPermission;
	zedToken: ReadRevision | undefined;
};

type ManyAccessParams = Omit<AccessParams, "organizationId"> & {
	organizationIds: readonly OrganizationId[];
};

/**
 * Those of the organisations SpiceDB grants the permission in. A denial at an
 * older revision may be a cache that has not caught up, so it is read again
 * at the newest.
 */
const grantedInSpiceDb = (params: ManyAccessParams) =>
	Effect.gen(function* () {
		const read = (
			entityIds: readonly OrganizationId[],
			zedToken: ReadRevision | undefined,
		) =>
			entityIds.length === 0
				? Effect.succeed(new Set<OrganizationId>())
				: permittedEntityIds({
						entityType: "organization",
						entityIds,
						permission: params.permission,
						userId: params.userId,
						zedToken,
					});
		const granted = yield* read(params.organizationIds, params.zedToken);
		if (params.zedToken === NEWEST_REVISION) return granted;
		const caughtUp = yield* read(
			params.organizationIds.filter((id) => !granted.has(id)),
			NEWEST_REVISION,
		);
		return new Set([
			...granted,
			...caughtUp,
		]);
	});

/**
 * Those of the organisations where the user holds the permission by their
 * committed role and in SpiceDB, so a demotion or removal counts before its
 * tuples arrive.
 */
export const permittedOrganizationIds = (params: ManyAccessParams) =>
	Effect.gen(function* () {
		const roles = yield* committedRoles(params);
		return yield* grantedInSpiceDb({
			...params,
			organizationIds: params.organizationIds.filter((id) => {
				const role = roles.get(id);
				return role !== undefined && roleGrants(role, params.permission);
			}),
		});
	});

/**
 * Whether the user holds the permission by their committed role and in
 * SpiceDB, so a demotion or removal counts before its tuples arrive.
 */
export const organizationPermitted = (params: AccessParams) =>
	permittedOrganizationIds({
		...params,
		organizationIds: [
			params.organizationId,
		],
	}).pipe(Effect.map((permitted) => permitted.has(params.organizationId)));

/**
 * Fails unless the user holds the permission by their committed role and in
 * SpiceDB. A committed grant SpiceDB does not hold at its newest revision is
 * pending, not denied: it answers `ACCESS_PENDING` until its tuples arrive.
 */
export const requireOrganizationAccess = (
	params: AccessParams & {
		/** The session's active organisation, where a missing membership means it was revoked. */
		active: boolean;
	},
) =>
	Effect.gen(function* () {
		const role = (yield* committedRoles({
			userId: params.userId,
			organizationIds: [
				params.organizationId,
			],
		})).get(params.organizationId);
		if (!role && params.active) {
			return yield* Effect.fail(
				new AppErrors.ForbiddenError({
					reason: "ORGANIZATION_MEMBERSHIP_REVOKED",
					message: "You are no longer a member of the selected organization.",
					data: {
						permission: params.permission,
						entityType: "organization",
					},
				}),
			);
		}
		if (!role || !roleGrants(role, params.permission)) {
			return yield* Effect.fail(
				permissionDenied({
					entityType: "organization",
					permission: params.permission,
					zedToken: params.zedToken,
				}),
			);
		}
		const granted = yield* grantedInSpiceDb({
			...params,
			organizationIds: [
				params.organizationId,
			],
		});
		if (!granted.has(params.organizationId)) {
			yield* Effect.logWarning(
				`organization.access_pending userId=${params.userId} organizationId=${params.organizationId} permission=${params.permission}`,
			);
			return yield* Effect.fail(
				new AppErrors.UnavailableError({
					reason: "ACCESS_PENDING",
					message:
						"The committed role grants access SpiceDB does not hold yet.",
				}),
			);
		}
		return role;
	});
