import type { OrganizationId, UserId } from "@orcai/core";
import {
	buildOrderBy,
	DB,
	dbSchema,
	idIn,
	pageOf,
	type SortExpression,
} from "@orcai/db";
import {
	ALL_MEMBERS_GROUP_SYSTEM_KEY,
	assetIdSchema,
	type BlockType,
	blockIdSchema,
	botIdSchema,
	inheritedOriginByResourceType,
	type ListMemberAccessInput,
	type MemberAccessOrigin,
	type MemberAccessSortKey,
	memberAccessOriginSchema,
	RESOURCE_GRANT_ORIGIN,
	RESOURCE_TYPES,
	type ResourceGrantRole,
	type ResourceType,
} from "@orcai/schema";
import {
	type EntityIdFor,
	grantedPermissions,
	permittedEntityIds,
	type ReadRevision,
} from "@orcai/spice-db";
import { and, asc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { committedPermittedIds, readableNow } from "@/lib/authz/content-access";
import { grantReaches } from "@/lib/authz/reaching-groups";
import { literalSearch } from "@/lib/utils/literal-search";

const scope = dbSchema.resourceScope;
const grant = dbSchema.resourceGrant;

const resourceName = sql<
	string | null
>`coalesce(${dbSchema.bot.name}, ${dbSchema.block.name}, ${dbSchema.asset.title})`;

/**
 * Where the access comes from: the strongest direct grant to the user or one
 * of their groups, else public visibility, else the resource's parent.
 */
const accessOrigin = (params: {
	userId: UserId;
	organizationId: OrganizationId;
}) => {
	const { group } = dbSchema;
	const directSource = sql`case
		when ${grant.principalType} = 'user' then ${RESOURCE_GRANT_ORIGIN.DIRECT_USER}
		when exists (
			select 1 from ${group}
			where ${group.id} = ${grant.principalId}
				and ${group.systemKey} = ${ALL_MEMBERS_GROUP_SYSTEM_KEY}
		) then ${RESOURCE_GRANT_ORIGIN.DIRECT_GROUP_ALL_MEMBERS}
		else ${RESOURCE_GRANT_ORIGIN.DIRECT_GROUP}
	end`;
	const roleRank = sql`case ${grant.role} when 'manager' then 3 when 'editor' then 2 else 1 end`;
	const inherited = sql`case ${scope.resourceType}
		${sql.join(
			RESOURCE_TYPES.map(
				(type) => sql`when ${type} then ${inheritedOriginByResourceType[type]}`,
			),
			sql` `,
		)}
	end`;

	return sql<MemberAccessOrigin>`coalesce(
		(select ${directSource} from ${grant}
			where ${grant.resourceType} = ${scope.resourceType}
				and ${grant.resourceId} = ${scope.resourceId}
				and ${grant.revokedAt} is null
				and ${grantReaches(params)}
			order by ${roleRank} desc, ${grant.createdAt} asc
			limit 1),
		(select ${RESOURCE_GRANT_ORIGIN.PUBLIC} from ${dbSchema.resourceVisibility}
			where ${dbSchema.resourceVisibility.resourceType} = ${scope.resourceType}
				and ${dbSchema.resourceVisibility.resourceId} = ${scope.resourceId}
				and ${dbSchema.resourceVisibility.visibility} = 'public'),
		${inherited}
	)`.mapWith((value) => memberAccessOriginSchema.parse(value));
};

/** The strongest role the user holds on each resource, in SpiceDB and by committed state. */
const rolesOf = <Entity extends ResourceType>(
	entityType: Entity,
	ids: EntityIdFor<Entity>[],
	userId: UserId,
	zedToken: ReadRevision | undefined,
) =>
	Effect.gen(function* () {
		if (ids.length === 0) {
			return new Map<string, ResourceGrantRole>();
		}

		const [granted, managed, edited] = yield* Effect.all(
			[
				grantedPermissions({
					entityIds: ids,
					entityType,
					permissions: [
						"manage_access",
						"edit",
					],
					userId,
					zedToken,
				}),
				committedPermittedIds(entityType, ids, userId, "manage_access"),
				committedPermittedIds(entityType, ids, userId, "edit"),
			],
			{
				concurrency: "unbounded",
			},
		);

		return new Map<string, ResourceGrantRole>(
			ids.map((id) => {
				const permissions = granted.get(id);
				return [
					id,
					permissions?.has("manage_access") && managed.has(id)
						? "manager"
						: permissions?.has("edit") && edited.has(id)
							? "editor"
							: "viewer",
				];
			}),
		);
	});

/**
 * One page of the organization's resources the user can read, in SpiceDB and
 * by committed state, with the role they effectively hold and where that
 * access comes from.
 */
export const effectiveAccess = (
	params: Omit<ListMemberAccessInput, "userId" | "zedToken"> & {
		userId: UserId;
		organizationId: OrganizationId;
		zedToken: ReadRevision | undefined;
	},
) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const { userId, organizationId, zedToken, filters } = params;

		const resourceTypes = filters?.resourceType
			? [
					filters.resourceType,
				]
			: RESOURCE_TYPES;
		const readableHere = (entityType: ResourceType) =>
			and(
				eq(scope.resourceType, entityType),
				readableNow(entityType, scope.resourceId, userId),
			);
		const scoped = yield* db
			.select({
				resourceType: scope.resourceType,
				resourceId: scope.resourceId,
			})
			.from(scope)
			.where(
				and(
					eq(scope.organizationId, organizationId),
					isNull(scope.endedAt),
					or(...resourceTypes.map(readableHere)),
				),
			);
		const readable = yield* Effect.forEach(
			resourceTypes,
			(entityType) =>
				permittedEntityIds({
					entityIds: scoped
						.filter((row) => row.resourceType === entityType)
						.map((row) => row.resourceId as EntityIdFor<typeof entityType>),
					entityType,
					permission: "read",
					userId,
					zedToken,
				}).pipe(
					Effect.map((ids) =>
						ids.size > 0
							? and(
									readableHere(entityType),
									idIn(scope.resourceId, [
										...ids,
									]),
								)
							: undefined,
					),
				),
			{
				concurrency: "unbounded",
			},
		);
		const readableClause = or(...readable);
		if (!readableClause) {
			return {
				data: [],
				rowCount: 0,
			};
		}

		const origin = accessOrigin({
			userId,
			organizationId,
		});
		const search = filters?.search ? literalSearch(filters.search) : undefined;
		const whereClause = and(
			eq(scope.organizationId, organizationId),
			isNull(scope.endedAt),
			readableClause,
			search ? ilike(resourceName, search) : undefined,
			filters?.origin ? eq(origin, filters.origin) : undefined,
		);

		const orderBy = buildOrderBy({
			sort: params.sort,
			allowlist: {
				resourceName,
				resourceType: scope.resourceType,
				origin,
			} satisfies Record<MemberAccessSortKey, SortExpression>,
			defaultOrder: [
				asc(resourceName),
			],
			tieBreaker: {
				id: "resourceId",
				expression: scope.resourceId,
			},
		});

		const { data: rows, rowCount } = yield* pageOf(
			db
				.select({
					resourceType: scope.resourceType,
					resourceId: scope.resourceId,
					resourceName,
					blockType: dbSchema.block.type,
					origin,
				})
				.from(scope)
				.leftJoin(
					dbSchema.bot,
					and(
						eq(scope.resourceType, "bot"),
						eq(dbSchema.bot.id, scope.resourceId),
					),
				)
				.leftJoin(
					dbSchema.block,
					and(
						eq(scope.resourceType, "block"),
						eq(dbSchema.block.id, scope.resourceId),
					),
				)
				.leftJoin(
					dbSchema.asset,
					and(
						eq(scope.resourceType, "asset"),
						eq(dbSchema.asset.id, scope.resourceId),
					),
				)
				.where(whereClause),
			params,
			orderBy,
		);

		const idsOf = (type: ResourceType) =>
			rows
				.filter((row) => row.resourceType === type)
				.map((row) => row.resourceId);
		const [botRoles, blockRoles, assetRoles] = yield* Effect.all(
			[
				rolesOf(
					"bot",
					botIdSchema.array().parse(idsOf("bot")),
					userId,
					zedToken,
				),
				rolesOf(
					"block",
					blockIdSchema.array().parse(idsOf("block")),
					userId,
					zedToken,
				),
				rolesOf(
					"asset",
					assetIdSchema.array().parse(idsOf("asset")),
					userId,
					zedToken,
				),
			],
			{
				concurrency: "unbounded",
			},
		);
		const roles = {
			bot: botRoles,
			block: blockRoles,
			asset: assetRoles,
		} satisfies Record<ResourceType, Map<string, ResourceGrantRole>>;

		const data = rows.map((row) => {
			const entry = {
				resourceId: row.resourceId,
				resourceName: row.resourceName,
				origin: row.origin,
				role: roles[row.resourceType].get(row.resourceId) ?? "viewer",
			};

			return row.resourceType === "block"
				? {
						...entry,
						resourceType: row.resourceType,
						blockType: row.blockType as BlockType,
					}
				: {
						...entry,
						resourceType: row.resourceType,
					};
		});

		return {
			data,
			rowCount,
		};
	});
