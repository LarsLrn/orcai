import type { GroupId, ModelId, OrganizationId, ProviderId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { and, eq, isNull, or } from "drizzle-orm";
import * as Effect from "effect/Effect";

/**
 * The groups an active pool of an enabled provider covers for the model, as
 * the resolver finds them, without opening a period; `allMembers` covers every
 * member. Exhaustion is not considered.
 */
export const coveringGroups = (params: {
	organizationId: OrganizationId;
	providerId: ProviderId;
	modelId: ModelId;
}) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const rows = yield* db
			.selectDistinct({
				groupId: dbSchema.group.id,
				kind: dbSchema.group.kind,
				systemKey: dbSchema.group.systemKey,
			})
			.from(dbSchema.quotaPool)
			.innerJoin(
				dbSchema.provider,
				and(
					eq(dbSchema.provider.id, dbSchema.quotaPool.providerId),
					eq(dbSchema.provider.organizationId, params.organizationId),
					eq(dbSchema.provider.enabled, true),
				),
			)
			.innerJoin(
				dbSchema.quotaPoolGroupAssignment,
				and(
					eq(
						dbSchema.quotaPoolGroupAssignment.quotaPoolId,
						dbSchema.quotaPool.id,
					),
					eq(dbSchema.quotaPoolGroupAssignment.isActive, true),
				),
			)
			.innerJoin(
				dbSchema.group,
				and(
					eq(dbSchema.group.id, dbSchema.quotaPoolGroupAssignment.groupId),
					eq(dbSchema.group.organizationId, params.organizationId),
					isNull(dbSchema.group.deletedAt),
				),
			)
			.where(
				and(
					eq(dbSchema.quotaPool.organizationId, params.organizationId),
					eq(dbSchema.quotaPool.providerId, params.providerId),
					eq(dbSchema.quotaPool.isActive, true),
					or(
						eq(dbSchema.quotaPool.modelId, params.modelId),
						isNull(dbSchema.quotaPool.modelId),
					),
				),
			);

		return {
			allMembers: rows.some(
				(row) => row.kind === "system" && row.systemKey === "all_members",
			),
			groupIds: new Set<GroupId>(rows.map((row) => row.groupId)),
		};
	});
