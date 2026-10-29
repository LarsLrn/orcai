import type { OrganizationId, UserId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { ALL_MEMBERS_GROUP_SYSTEM_KEY } from "@orcai/schema";
import {
	type EntityIdFor,
	permittedEntityIds,
	type ResourceType,
} from "@orcai/spice-db";
import { and, eq, exists, inArray, isNull, or, sql } from "drizzle-orm";
import * as Effect from "effect/Effect";
import * as AppErrors from "@/lib/effect/utils/errors";

const resourceTables = {
	bot: dbSchema.bot,
	block: dbSchema.block,
	asset: dbSchema.asset,
};

/** The groups of the organisation whose grants reach the user, All Members included. */
const memberGroupIds = (userId: UserId, organizationId: OrganizationId) => {
	const group = dbSchema.group;
	const groupMember = dbSchema.groupMember;
	return sql`(
		select ${group.id} from ${group}
		where ${group.organizationId} = ${organizationId}
			and ${group.deletedAt} is null
			and (
				(${group.kind} = 'system' and ${group.systemKey} = ${ALL_MEMBERS_GROUP_SYSTEM_KEY})
				or exists (
					select 1 from ${groupMember}
					where ${groupMember.groupId} = ${group.id}
						and ${groupMember.userId} = ${userId}
						and ${groupMember.removedAt} is null
				)
			)
	)`;
};

/**
 * The resources the user may use in the organisation. Each needs SpiceDB
 * `use`, an active scope in the organisation, the user's membership there,
 * and either a grant issued there to the user or one of their groups there,
 * or ownership when the organisation is the resource's home.
 */
export const usableInOrganization = <Type extends ResourceType>(params: {
	resourceType: Type;
	resourceIds: readonly EntityIdFor<Type>[];
	userId: UserId;
	organizationId: OrganizationId | undefined;
	zedToken: string | undefined;
}) =>
	Effect.gen(function* () {
		const { organizationId, userId } = params;
		if (!organizationId || params.resourceIds.length === 0)
			return new Set<EntityIdFor<Type>>();
		const db = yield* DB;
		const scope = dbSchema.resourceScope;
		const grant = dbSchema.resourceGrant;
		const table = resourceTables[params.resourceType];

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
					.select({
						resourceId: scope.resourceId,
					})
					.from(scope)
					.where(
						and(
							eq(scope.resourceType, params.resourceType),
							inArray(scope.resourceId, [
								...params.resourceIds,
							]),
							eq(scope.organizationId, organizationId),
							isNull(scope.endedAt),
							exists(
								db
									.select({
										one: sql`1`,
									})
									.from(dbSchema.member)
									.where(
										and(
											eq(dbSchema.member.organizationId, organizationId),
											eq(dbSchema.member.userId, userId),
										),
									),
							),
							or(
								and(
									eq(scope.isPrimary, true),
									exists(
										db
											.select({
												one: sql`1`,
											})
											.from(table)
											.where(
												and(
													sql`${table.id} = ${scope.resourceId}`,
													eq(table.userId, userId),
												),
											),
									),
								),
								exists(
									db
										.select({
											one: sql`1`,
										})
										.from(grant)
										.where(
											and(
												eq(grant.resourceType, scope.resourceType),
												eq(grant.resourceId, scope.resourceId),
												eq(grant.organizationId, organizationId),
												isNull(grant.revokedAt),
												or(
													and(
														eq(grant.principalType, "user"),
														eq(grant.principalId, userId),
													),
													and(
														eq(grant.principalType, "group"),
														sql`${grant.principalId} in ${memberGroupIds(userId, organizationId)}`,
													),
												),
											),
										),
								),
							),
						),
					),
			],
			{
				concurrency: "unbounded",
			},
		);

		return new Set(
			scoped
				.map((row) => row.resourceId as EntityIdFor<Type>)
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
