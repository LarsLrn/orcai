import type { UserId } from "@orcai/core";
import { DB, dbSchema, resourceTables } from "@orcai/db";
import {
	type EntityIdFor,
	permittedEntityIds,
	type ReadRevision,
	type ResourceType,
} from "@orcai/spice-db";
import { type AnyColumn, and, inArray, type SQL, sql } from "drizzle-orm";
import { alias, QueryBuilder } from "drizzle-orm/pg-core";
import * as Effect from "effect/Effect";
import { permissionDenied } from "@/lib/authz/permission-denied";
import { grantReaches } from "@/lib/authz/reaching-groups";
import * as AppErrors from "@/lib/effect/utils/errors";

type Reader = {
	userId: UserId;
	zedToken: ReadRevision | undefined;
};

/** Whether the user owns the resource in `id`. */
const ownedBy = (
	resourceType: ResourceType,
	id: AnyColumn | SQL,
	userId: UserId,
) => {
	// Aliased, so `id` may be a column of the same table in the outer query.
	const owned = alias(resourceTables[resourceType], `owned_${resourceType}`);
	const ownership = new QueryBuilder()
		.select({
			one: sql`1`,
		})
		.from(owned)
		.where(sql`${owned.id} = ${id} and ${owned.userId} = ${userId}`);
	return sql`exists ${ownership}`;
};

/** Whether the user, or a group of theirs, holds an active grant on the resource in `id`, in one of `roles` when given. */
const grantedTo = (
	resourceType: ResourceType,
	id: AnyColumn | SQL,
	userId: UserId,
	roles?: readonly ("manager" | "editor")[],
) => {
	const { resourceGrant: grant } = dbSchema;
	return sql`exists (
		select 1 from ${grant}
		where ${grant.resourceType} = ${resourceType}
			and ${grant.resourceId} = ${id}
			and ${grant.revokedAt} is null
			${
				roles
					? sql`and ${inArray(grant.role, [
							...roles,
						])}`
					: sql``
			}
			and ${grantReaches({
				userId,
			})}
	)`;
};

/** Whether the user owns the resource in `id`, holds an active grant on it, or it is listed. */
const readableDirectly = (
	resourceType: ResourceType,
	id: AnyColumn | SQL,
	userId: UserId,
) => {
	const { resourceVisibility: visibility } = dbSchema;
	return sql`(
		${ownedBy(resourceType, id, userId)}
		or exists (
			select 1 from ${visibility}
			where ${visibility.resourceType} = ${resourceType}
				and ${visibility.resourceId} = ${id}
				and ${visibility.visibility} = 'public'
		)
		or ${grantedTo(resourceType, id, userId)}
	)`;
};

/**
 * Whether the user may read the resource in `id` by committed Postgres state:
 * directly, or through a linked bot (blocks) or repository (assets) they may
 * read. SpiceDB can still hold a grant, listing or link whose row is gone
 * until its tuples are delivered; combining both rejects such stale paths.
 */
export const readableNow = (
	resourceType: ResourceType,
	id: AnyColumn | SQL,
	userId: UserId,
): SQL => {
	const { botBlock, blockAsset } = dbSchema;
	const throughBot = (blockId: AnyColumn | SQL) => sql`exists (
		select 1 from ${botBlock}
		where ${botBlock.blockId} = ${blockId}
			and ${readableDirectly("bot", botBlock.botId, userId)}
	)`;
	switch (resourceType) {
		case "bot":
			return readableDirectly("bot", id, userId);
		case "block":
			return sql`(${readableDirectly("block", id, userId)} or ${throughBot(id)})`;
		case "asset":
			return sql`(${readableDirectly("asset", id, userId)} or exists (
				select 1 from ${blockAsset}
				where ${blockAsset.assetId} = ${id}
					and (${readableDirectly("block", blockAsset.blockId, userId)} or ${throughBot(blockAsset.blockId)})
			))`;
	}
};

export type ResourcePermission = "read" | "edit" | "delete" | "manage_access";

/**
 * Whether the user holds `permission` on the resource in `id` by committed
 * Postgres state. Edit, delete and manage access come from ownership or an
 * active grant only: editors edit, managers also delete and manage access.
 */
export const permittedNow = (
	resourceType: ResourceType,
	id: AnyColumn | SQL,
	userId: UserId,
	permission: ResourcePermission,
): SQL =>
	permission === "read"
		? readableNow(resourceType, id, userId)
		: sql`(${ownedBy(resourceType, id, userId)} or ${grantedTo(
				resourceType,
				id,
				userId,
				permission === "edit"
					? [
							"manager",
							"editor",
						]
					: [
							"manager",
						],
			)})`;

/**
 * The resources committed Postgres state permits, without checking SpiceDB.
 * Only for narrowing SpiceDB results; access decisions use {@link permittedIds}.
 */
export const committedPermittedIds = <Type extends ResourceType>(
	resourceType: Type,
	ids: readonly EntityIdFor<Type>[],
	userId: UserId,
	permission: ResourcePermission,
) =>
	Effect.gen(function* () {
		if (ids.length === 0) return new Set<EntityIdFor<Type>>();
		const db = yield* DB;
		const table = resourceTables[resourceType];
		const rows = yield* db
			.select({
				id: table.id,
			})
			.from(table)
			.where(
				and(
					inArray(table.id, [
						...ids,
					] as (typeof table.id._.data)[]),
					permittedNow(resourceType, table.id, userId, permission),
				),
			);
		const committed = new Set<string>(rows.map((row) => row.id));
		return new Set(ids.filter((id) => committed.has(id)));
	});

/**
 * The resources of `ids` the user holds `permission` on, in SpiceDB and by
 * committed state. SpiceDB keeps a revoked grant until its tuples are
 * delivered; the committed state closes it at once. A mutation checks again
 * under its organisation write lock, after which no revocation can commit.
 */
export const permittedIds = <Type extends ResourceType>(
	resourceType: Type,
	ids: readonly EntityIdFor<Type>[],
	reader: Reader,
	permission: ResourcePermission,
) =>
	Effect.gen(function* () {
		if (ids.length === 0) return new Set<EntityIdFor<Type>>();
		const [permitted, committed] = yield* Effect.all(
			[
				permittedEntityIds({
					entityIds: ids,
					entityType: resourceType,
					permission,
					...reader,
				}),
				committedPermittedIds(resourceType, ids, reader.userId, permission),
			],
			{
				concurrency: "unbounded",
			},
		);
		return new Set(ids.filter((id) => committed.has(id) && permitted.has(id)));
	});

/** The resources of `ids` the user may read, see {@link permittedIds}. */
export const readableIds = <Type extends ResourceType>(
	resourceType: Type,
	ids: readonly EntityIdFor<Type>[],
	reader: Reader,
) => permittedIds(resourceType, ids, reader, "read");

/**
 * Fails unless the user holds `permission` on every resource of `ids`, see
 * {@link permittedIds}: as not found for read, else as denied.
 */
export const requirePermitted = <Type extends ResourceType>(
	resourceType: Type,
	ids: readonly EntityIdFor<Type>[],
	reader: Reader,
	permission: ResourcePermission,
) =>
	permittedIds(resourceType, ids, reader, permission).pipe(
		Effect.flatMap((permitted) => {
			const refused = ids.find((id) => !permitted.has(id));
			if (refused === undefined) return Effect.void;
			return Effect.fail(
				permission === "read"
					? new AppErrors.NotFoundError({
							id: refused,
							message: "Resource not found",
						})
					: permissionDenied({
							entityType: resourceType,
							permission,
							zedToken: reader.zedToken,
						}),
			);
		}),
	);
