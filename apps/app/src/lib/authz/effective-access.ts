import type { GroupId, OrganizationId, UserId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import {
	ALL_MEMBERS_GROUP_SYSTEM_KEY,
	assetIdSchema,
	blockIdSchema,
	botIdSchema,
	inheritedSourceByResourceType,
	type ListUserAccessInput,
	RESOURCE_GRANT_SOURCE,
	RESOURCE_TYPES,
	type ResourceGrantRole,
	type ResourceType,
	type UserAccessSortKey,
	type UserAccessSource,
	userAccessSourceSchema,
} from "@orcai/schema";
import {
	type EntityIdFor,
	grantedPermissions,
	lookupEntitiesByPermission,
} from "@orcai/spice-db";
import {
	and,
	asc,
	count,
	eq,
	ilike,
	inArray,
	isNull,
	or,
	sql,
} from "drizzle-orm";
import * as Effect from "effect/Effect";
import {
	buildOrderBy,
	type SortExpression,
} from "@/lib/orpc/router/helpers/sorting";
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
const accessSource = (params: {
	userId: UserId;
	groupIds: GroupId[];
	allMembersGroupId: GroupId | undefined;
}) => {
	const principal = or(
		and(eq(grant.principalType, "user"), eq(grant.principalId, params.userId)),
		params.groupIds.length > 0
			? and(
					eq(grant.principalType, "group"),
					inArray(grant.principalId, params.groupIds),
				)
			: undefined,
	);
	const directSource = sql`case
		when ${grant.principalType} = 'user' then ${RESOURCE_GRANT_SOURCE.DIRECT_USER}
		when ${grant.principalId} = ${params.allMembersGroupId ?? null} then ${RESOURCE_GRANT_SOURCE.DIRECT_GROUP_ALL_MEMBERS}
		else ${RESOURCE_GRANT_SOURCE.DIRECT_GROUP}
	end`;
	const roleRank = sql`case ${grant.role} when 'manager' then 3 when 'editor' then 2 else 1 end`;
	const inherited = sql`case ${scope.resourceType}
		${sql.join(
			RESOURCE_TYPES.map(
				(type) => sql`when ${type} then ${inheritedSourceByResourceType[type]}`,
			),
			sql` `,
		)}
	end`;

	return sql<UserAccessSource>`coalesce(
		(select ${directSource} from ${grant}
			where ${grant.resourceType} = ${scope.resourceType}
				and ${grant.resourceId} = ${scope.resourceId}
				and ${grant.revokedAt} is null
				and ${principal}
			order by ${roleRank} desc, ${grant.createdAt} asc
			limit 1),
		(select ${RESOURCE_GRANT_SOURCE.PUBLIC} from ${dbSchema.resourceVisibility}
			where ${dbSchema.resourceVisibility.resourceType} = ${scope.resourceType}
				and ${dbSchema.resourceVisibility.resourceId} = ${scope.resourceId}
				and ${dbSchema.resourceVisibility.visibility} = 'public'),
		${inherited}
	)`.mapWith((value) => userAccessSourceSchema.parse(value));
};

/** The strongest role the user holds on each resource, from SpiceDB. */
const rolesOf = <Entity extends ResourceType>(
	entityType: Entity,
	ids: EntityIdFor<Entity>[],
	userId: UserId,
	zedToken: string | undefined,
) =>
	Effect.gen(function* () {
		if (ids.length === 0) {
			return new Map<string, ResourceGrantRole>();
		}

		const granted = yield* grantedPermissions({
			entityIds: ids,
			entityType,
			permissions: [
				"manage_access",
				"edit",
				"read",
			],
			userId,
			zedToken,
		});

		return new Map<string, ResourceGrantRole>(
			ids.map((id) => {
				const permissions = granted.get(id);
				return [
					id,
					permissions?.has("manage_access")
						? "manager"
						: permissions?.has("edit")
							? "editor"
							: "viewer",
				];
			}),
		);
	});

/**
 * One page of the organization's resources the user can read, with the role
 * they effectively hold and where that access comes from.
 */
export const effectiveAccess = (
	params: Omit<ListUserAccessInput, "id" | "zedToken"> & {
		userId: UserId;
		organizationId: OrganizationId;
		zedToken: string | undefined;
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
		const readable = yield* Effect.forEach(
			resourceTypes,
			(entityType) =>
				lookupEntitiesByPermission({
					userId,
					permission: "read",
					entityType,
					zedToken,
				}).pipe(
					Effect.map((ids) =>
						ids.length > 0
							? and(
									eq(scope.resourceType, entityType),
									inArray(scope.resourceId, ids),
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

		const [[allMembersGroup], groupMemberships] = yield* Effect.all(
			[
				db
					.select({
						id: dbSchema.group.id,
					})
					.from(dbSchema.group)
					.where(
						and(
							eq(dbSchema.group.organizationId, organizationId),
							eq(dbSchema.group.kind, "system"),
							eq(dbSchema.group.systemKey, ALL_MEMBERS_GROUP_SYSTEM_KEY),
							isNull(dbSchema.group.deletedAt),
						),
					)
					.limit(1),
				db
					.select({
						groupId: dbSchema.groupMember.groupId,
					})
					.from(dbSchema.groupMember)
					.innerJoin(
						dbSchema.group,
						eq(dbSchema.group.id, dbSchema.groupMember.groupId),
					)
					.where(
						and(
							eq(dbSchema.groupMember.userId, userId),
							isNull(dbSchema.groupMember.removedAt),
							eq(dbSchema.group.organizationId, organizationId),
							isNull(dbSchema.group.deletedAt),
						),
					),
			],
			{
				concurrency: "unbounded",
			},
		);

		const source = accessSource({
			userId,
			groupIds: [
				...groupMemberships.map((membership) => membership.groupId),
				...(allMembersGroup
					? [
							allMembersGroup.id,
						]
					: []),
			],
			allMembersGroupId: allMembersGroup?.id,
		});
		const search = filters?.search ? literalSearch(filters.search) : undefined;
		const whereClause = and(
			eq(scope.organizationId, organizationId),
			isNull(scope.endedAt),
			readableClause,
			search ? ilike(resourceName, search) : undefined,
			filters?.source ? eq(source, filters.source) : undefined,
		);

		const orderBy = yield* buildOrderBy({
			sort: params.sort,
			allowlist: {
				resourceName,
				resourceType: scope.resourceType,
				source,
			} satisfies Record<UserAccessSortKey, SortExpression>,
			defaultOrder: [
				asc(resourceName),
			],
			tieBreaker: {
				id: "resourceId",
				expression: scope.resourceId,
			},
		});

		const [rows, [rowCount]] = yield* Effect.all(
			[
				db
					.select({
						resourceType: scope.resourceType,
						resourceId: scope.resourceId,
						resourceName,
						source,
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
					.where(whereClause)
					.orderBy(...orderBy)
					.limit(params.pageSize)
					.offset(params.pageIndex * params.pageSize),
				db
					.select({
						count: count(),
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
			],
			{
				concurrency: "unbounded",
			},
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

		const data = rows.map((row) => ({
			resourceType: row.resourceType,
			resourceId: row.resourceId,
			resourceName: row.resourceName,
			source: row.source,
			role: roles[row.resourceType].get(row.resourceId) ?? "viewer",
		}));

		return {
			data,
			rowCount: rowCount.count,
		};
	});
