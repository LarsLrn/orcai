import type { OrganizationId, UserId } from "@orcai/core";
import { DB, dbSchema, resourceTables } from "@orcai/db";
import {
	type EntityIdFor,
	permittedEntityIds,
	type ReadRevision,
	type ResourceType,
} from "@orcai/spice-db";
import { type AnyColumn, and, eq, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import * as Effect from "effect/Effect";
import { grantReaches } from "@/lib/authz/reaching-groups";
import * as AppErrors from "@/lib/effect/utils/errors";

/**
 * Postgres's part of using the resource in `id` in the organisation: an
 * active scope there, the user's membership there, and either a grant issued
 * there to the user or one of their groups there, or ownership when the
 * organisation is the resource's home. SpiceDB `use` completes it.
 */
export const usableHere = (params: {
	resourceType: ResourceType;
	id: AnyColumn;
	userId: UserId;
	organizationId: OrganizationId;
}) => {
	const { organizationId, userId } = params;
	// Aliased so `id` may come from a resource_scope row of the outer query.
	const scope = alias(dbSchema.resourceScope, "usable_scope");
	const scopeTable = sql`${dbSchema.resourceScope} ${sql.identifier("usable_scope")}`;
	const grant = dbSchema.resourceGrant;
	const member = dbSchema.member;
	const table = resourceTables[params.resourceType];
	return sql`exists (
		select 1 from ${scopeTable}
		where ${scope.resourceType} = ${params.resourceType}
			and ${scope.resourceId} = ${params.id}
			and ${scope.organizationId} = ${organizationId}
			and ${scope.endedAt} is null
			and exists (
				select 1 from ${member}
				where ${member.organizationId} = ${organizationId}
					and ${member.userId} = ${userId}
			)
			and (
				(${scope.isPrimary} and exists (
					select 1 from ${table}
					where ${table.id} = ${scope.resourceId}
						and ${table.userId} = ${userId}
				))
				or exists (
					select 1 from ${grant}
					where ${grant.resourceType} = ${scope.resourceType}
						and ${grant.resourceId} = ${scope.resourceId}
						and ${grant.organizationId} = ${organizationId}
						and ${grant.revokedAt} is null
						and ${grantReaches({
							userId,
							organizationId,
						})}
				)
			)
	)`;
};

/**
 * The resources the user may use in the organisation: SpiceDB `use` and
 * {@link usableHere}.
 */
export const usableInOrganization = <Type extends ResourceType>(params: {
	resourceType: Type;
	resourceIds: readonly EntityIdFor<Type>[];
	userId: UserId;
	organizationId: OrganizationId | undefined;
	zedToken: ReadRevision | undefined;
}) =>
	Effect.gen(function* () {
		const { organizationId, userId } = params;
		if (!organizationId || params.resourceIds.length === 0)
			return new Set<EntityIdFor<Type>>();
		const db = yield* DB;
		const scope = dbSchema.resourceScope;

		const [permitted, scoped] = yield* Effect.all(
			[
				permittedEntityIds({
					entityIds: params.resourceIds,
					entityType: params.resourceType,
					permission: "use",
					userId,
					zedToken: params.zedToken,
				}),
				db
					.selectDistinct({
						id: scope.resourceId,
					})
					.from(scope)
					.where(
						and(
							eq(scope.resourceType, params.resourceType),
							inArray(scope.resourceId, [
								...params.resourceIds,
							]),
							usableHere({
								resourceType: params.resourceType,
								id: scope.resourceId,
								userId,
								organizationId,
							}),
						),
					),
			],
			{
				concurrency: "unbounded",
			},
		);

		return new Set(
			scoped
				.map((row) => row.id as EntityIdFor<Type>)
				.filter((id) => permitted.has(id)),
		);
	});

/** Fails unless the user may use every resource in the organisation. */
export const requireUsableInOrganization = <Type extends ResourceType>(
	params: Parameters<typeof usableInOrganization<Type>>[0],
) =>
	usableInOrganization(params).pipe(
		Effect.flatMap((usable) =>
			params.resourceIds.every((id) => usable.has(id))
				? Effect.void
				: Effect.fail(
						new AppErrors.ForbiddenError({
							reason: "RESOURCE_NOT_USABLE_IN_ORGANIZATION",
							message:
								"This resource is not available to you in this organisation.",
						}),
					),
		),
	);
