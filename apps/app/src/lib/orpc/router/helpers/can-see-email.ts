import type { OrganizationId, UserId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import type { ResourceIdentity } from "@orcai/schema";
import { and, eq, isNull } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { hasManageGroups } from "@/lib/authz/group-visibility";

/** Whether the caller manages groups in every one of these organisations. */
export const canSeeEmailIn = (params: {
	organizationIds: readonly OrganizationId[];
	userId: UserId;
	zedToken?: string;
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
	zedToken?: string;
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
