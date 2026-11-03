import {
	ORGANIZATION_ROLE_PERMISSIONS,
	type OrganizationId,
	type OrganizationPermission,
	type OrganizationRole,
	type UserId,
} from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import {
	checkEntityPermission,
	NEWEST_REVISION,
	type ReadRevision,
} from "@orcai/spice-db";
import { and, eq, inArray } from "drizzle-orm";
import * as Effect from "effect/Effect";
import * as AppErrors from "@/lib/effect/utils/errors";
import { permissionDenied } from "@/lib/orpc/middlewares/permission/core";

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

type AccessParams = {
	organizationId: OrganizationId;
	userId: UserId;
	permission: OrganizationPermission;
	zedToken: ReadRevision | undefined;
};

const permittedInSpiceDb = (params: AccessParams) =>
	checkEntityPermission({
		entityType: "organization",
		entityId: params.organizationId,
		permission: params.permission,
		userId: params.userId,
		zedToken: params.zedToken,
	});

/**
 * Whether the user holds the permission by their committed role and in
 * SpiceDB, so a demotion or removal counts before its tuples arrive.
 */
export const organizationPermitted = (params: AccessParams) =>
	Effect.gen(function* () {
		const role = (yield* committedRoles({
			userId: params.userId,
			organizationIds: [
				params.organizationId,
			],
		})).get(params.organizationId);
		if (!role || !roleGrants(role, params.permission)) return false;
		return yield* permittedInSpiceDb(params);
	});

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
		// A denial at an older revision may be a cache that has not caught up;
		// only one at the newest means the tuples have not arrived.
		const granted =
			(yield* permittedInSpiceDb(params)) ||
			(params.zedToken !== NEWEST_REVISION &&
				(yield* permittedInSpiceDb({
					...params,
					zedToken: NEWEST_REVISION,
				})));
		if (!granted) {
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
