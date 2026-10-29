import type { UserId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { ALL_MEMBERS_GROUP_SYSTEM_KEY } from "@orcai/schema";
import {
	type EntityIdFor,
	permittedEntityIds,
	type ResourceType,
} from "@orcai/spice-db";
import { type AnyColumn, and, inArray, type SQL, sql } from "drizzle-orm";
import { alias, QueryBuilder } from "drizzle-orm/pg-core";
import * as Effect from "effect/Effect";
import * as AppErrors from "@/lib/effect/utils/errors";

type Reader = {
	userId: UserId;
	zedToken: string | undefined;
};

const resourceTables = {
	bot: dbSchema.bot,
	block: dbSchema.block,
	asset: dbSchema.asset,
};

/** The groups whose grants reach the user: joined ones and the All Members of their organisations. */
const readerGroupIds = (userId: UserId) => {
	const { group, groupMember, member } = dbSchema;
	return sql`(
		select ${group.id} from ${group}
		where ${group.deletedAt} is null
			and (
				exists (
					select 1 from ${groupMember}
					where ${groupMember.groupId} = ${group.id}
						and ${groupMember.userId} = ${userId}
						and ${groupMember.removedAt} is null
				)
				or (
					${group.kind} = 'system'
					and ${group.systemKey} = ${ALL_MEMBERS_GROUP_SYSTEM_KEY}
					and exists (
						select 1 from ${member}
						where ${member.organizationId} = ${group.organizationId}
							and ${member.userId} = ${userId}
					)
				)
			)
	)`;
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

/** Whether the user, or a group of theirs, holds an active grant on the resource in `id`, of `role` when given. */
const grantedTo = (
	resourceType: ResourceType,
	id: AnyColumn | SQL,
	userId: UserId,
	role?: "manager",
) => {
	const { resourceGrant: grant } = dbSchema;
	return sql`exists (
		select 1 from ${grant}
		where ${grant.resourceType} = ${resourceType}
			and ${grant.resourceId} = ${id}
			and ${grant.revokedAt} is null
			${role ? sql`and ${grant.role} = ${role}` : sql``}
			and (
				(${grant.principalType} = 'user' and ${grant.principalId} = ${userId})
				or (${grant.principalType} = 'group' and ${grant.principalId} in ${readerGroupIds(userId)})
			)
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

/** The resources of `ids` the user holds `permission` on in SpiceDB whose committed state agrees. */
const permittedNow = <Type extends ResourceType>(
	resourceType: Type,
	ids: readonly EntityIdFor<Type>[],
	reader: Reader,
	permission: "read" | "manage_access",
	committed: (id: AnyColumn) => SQL,
) =>
	Effect.gen(function* () {
		if (ids.length === 0) return new Set<EntityIdFor<Type>>();
		const db = yield* DB;
		const table = resourceTables[resourceType];
		const [permitted, rows] = yield* Effect.all(
			[
				permittedEntityIds({
					entityIds: ids,
					entityType: resourceType,
					permission,
					...reader,
				}),
				db
					.select({
						id: table.id,
					})
					.from(table)
					.where(
						and(
							inArray(table.id, [
								...ids,
							] as (typeof table.id._.data)[]),
							committed(table.id),
						),
					),
			],
			{
				concurrency: "unbounded",
			},
		);
		const agreed = new Set<string>(rows.map((row) => row.id));
		return new Set(ids.filter((id) => agreed.has(id) && permitted.has(id)));
	});

/** The resources of `ids` the user may read, in SpiceDB and by committed state. */
export const readableIds = <Type extends ResourceType>(
	resourceType: Type,
	ids: readonly EntityIdFor<Type>[],
	reader: Reader,
) =>
	permittedNow(resourceType, ids, reader, "read", (id) =>
		readableNow(resourceType, id, reader.userId),
	);

/**
 * The resources of `ids` whose access the user manages, in SpiceDB and by
 * committed state: they own it or hold an active manager grant, directly or
 * through a group.
 */
export const managedIds = <Type extends ResourceType>(
	resourceType: Type,
	ids: readonly EntityIdFor<Type>[],
	reader: Reader,
) =>
	permittedNow(
		resourceType,
		ids,
		reader,
		"manage_access",
		(id) =>
			sql`(${ownedBy(resourceType, id, reader.userId)} or ${grantedTo(resourceType, id, reader.userId, "manager")})`,
	);

/** Fails as not found unless the user may read the resource, see {@link readableIds}. */
export const requireReadable = <Type extends ResourceType>(
	resourceType: Type,
	id: EntityIdFor<Type>,
	reader: Reader,
) =>
	readableIds(
		resourceType,
		[
			id,
		],
		reader,
	).pipe(
		Effect.flatMap((readable) =>
			readable.has(id)
				? Effect.void
				: Effect.fail(
						new AppErrors.NotFoundError({
							id,
							message: "Resource not found",
						}),
					),
		),
	);
