import type { OrganizationId, UserId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import type { ResourceIdentity } from "@orcai/schema";
import type { ReadRevision } from "@orcai/spice-db";
import { and, eq, ilike, isNull, or } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { hasManageGroups } from "@/lib/authz/group-visibility";

/**
 * Who sees a member's email in a people picker: someone who manages groups
 * in every organisation the picker covers. Everyone else sees names only.
 */
export const canSeeEmailIn = (params: {
	organizationIds: readonly OrganizationId[];
	userId: UserId;
	zedToken?: ReadRevision;
}) =>
	Effect.all(
		params.organizationIds.map((organizationId) =>
			hasManageGroups({
				organizationId,
				userId: params.userId,
				zedToken: params.zedToken,
			}),
		),
		{
			concurrency: "unbounded",
		},
	).pipe(
		Effect.map(
			(permissions) => permissions.length > 0 && permissions.every(Boolean),
		),
	);

/** Whether the caller manages groups in every organisation the resource is scoped to. */
export const canSeeEmailOn = (params: {
	resource: ResourceIdentity;
	userId: UserId;
	zedToken?: ReadRevision;
}) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const scopes = yield* db
			.select({
				organizationId: dbSchema.resourceScope.organizationId,
			})
			.from(dbSchema.resourceScope)
			.where(
				and(
					eq(dbSchema.resourceScope.resourceType, params.resource.resourceType),
					eq(dbSchema.resourceScope.resourceId, params.resource.resourceId),
					isNull(dbSchema.resourceScope.endedAt),
				),
			);

		return yield* canSeeEmailIn({
			organizationIds: scopes.map((scope) => scope.organizationId),
			userId: params.userId,
			zedToken: params.zedToken,
		});
	});

/** The user columns a picker answers with. */
export const visibleUserColumns = (canSeeEmail: boolean) => ({
	id: dbSchema.user.id,
	name: dbSchema.user.name,
	...(canSeeEmail
		? {
				email: dbSchema.user.email,
			}
		: {}),
	image: dbSchema.user.image,
});

/** Matches the name, and the email only where it is visible. */
export const visibleUserSearch = (params: {
	pattern: string | undefined;
	canSeeEmail: boolean;
}) =>
	params.pattern
		? or(
				ilike(dbSchema.user.name, params.pattern),
				params.canSeeEmail
					? ilike(dbSchema.user.email, params.pattern)
					: undefined,
			)
		: undefined;
