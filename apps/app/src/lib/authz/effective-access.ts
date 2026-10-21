import type { OrganizationId, UserId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import {
	ALL_MEMBERS_GROUP_SYSTEM_KEY,
	assetIdSchema,
	blockIdSchema,
	botIdSchema,
	type DirectGrantSource,
	inheritedSourceByResourceType,
	RESOURCE_GRANT_SOURCE,
	RESOURCE_TYPES,
	type ResourceGrantRole,
} from "@orcai/schema";
import {
	type EntityIdFor,
	grantedPermissions,
	lookupEntitiesByPermission,
} from "@orcai/spice-db";
import { and, eq, inArray, isNull, or } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { unique } from "@/lib/utils/array-utils";

/**
 * The organization's resources the user can read, with the role they
 * effectively hold and where that access comes from, newest first.
 */
export const effectiveAccess = (params: {
	userId: UserId;
	organizationId: OrganizationId;
	zedToken: string | undefined;
}) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const { organizationId, zedToken } = params;

		const resourceTypes = RESOURCE_TYPES;
		const [allowedBots, allowedBlocks, allowedAssets] = yield* Effect.all(
			[
				lookupEntitiesByPermission({
					userId: params.userId,
					permission: "read",
					entityType: "bot",
					zedToken,
				}).pipe(
					Effect.map((items) =>
						items.map((resourceId) => ({
							resourceType: "bot" as const,
							resourceId,
						})),
					),
				),
				lookupEntitiesByPermission({
					userId: params.userId,
					permission: "read",
					entityType: "block",
					zedToken,
				}).pipe(
					Effect.map((items) =>
						items.map((resourceId) => ({
							resourceType: "block" as const,
							resourceId,
						})),
					),
				),
				lookupEntitiesByPermission({
					userId: params.userId,
					permission: "read",
					entityType: "asset",
					zedToken,
				}).pipe(
					Effect.map((items) =>
						items.map((resourceId) => ({
							resourceType: "asset" as const,
							resourceId,
						})),
					),
				),
			],
			{
				concurrency: "unbounded",
			},
		);

		const allowedResources = [
			...allowedBots,
			...allowedBlocks,
			...allowedAssets,
		];
		if (allowedResources.length === 0) {
			return [];
		}

		const allAllowedIds = unique(
			allowedResources.map((resource) => resource.resourceId),
		);
		const scopedResources = yield* db
			.select({
				resourceType: dbSchema.resourceScope.resourceType,
				resourceId: dbSchema.resourceScope.resourceId,
			})
			.from(dbSchema.resourceScope)
			.where(
				and(
					eq(dbSchema.resourceScope.organizationId, organizationId),
					isNull(dbSchema.resourceScope.endedAt),
					inArray(dbSchema.resourceScope.resourceType, resourceTypes),
					inArray(dbSchema.resourceScope.resourceId, allAllowedIds),
				),
			);

		if (scopedResources.length === 0) {
			return [];
		}

		const scopedResourceIds = unique(
			scopedResources.map((resource) => resource.resourceId),
		);
		const botIds = botIdSchema
			.array()
			.parse(
				scopedResources
					.filter((resource) => resource.resourceType === "bot")
					.map((resource) => resource.resourceId),
			);
		const blockIds = blockIdSchema
			.array()
			.parse(
				scopedResources
					.filter((resource) => resource.resourceType === "block")
					.map((resource) => resource.resourceId),
			);
		const assetIds = assetIdSchema
			.array()
			.parse(
				scopedResources
					.filter((resource) => resource.resourceType === "asset")
					.map((resource) => resource.resourceId),
			);

		const roleForAllowedIds = <Entity extends (typeof RESOURCE_TYPES)[number]>(
			entityType: Entity,
			ids: EntityIdFor<Entity>[],
		) =>
			Effect.gen(function* () {
				const granted = yield* grantedPermissions({
					entityIds: ids,
					entityType,
					permissions: [
						"manage_access",
						"edit",
						"read",
					],
					userId: params.userId,
					zedToken,
				});

				const entries: Array<
					readonly [
						EntityIdFor<Entity>,
						ResourceGrantRole,
					]
				> = [];

				for (const id of ids) {
					const permissions = granted.get(id);
					if (permissions?.has("manage_access")) {
						entries.push([
							id,
							"manager",
						]);
						continue;
					}
					if (permissions?.has("edit")) {
						entries.push([
							id,
							"editor",
						]);
						continue;
					}
					if (permissions?.has("read")) {
						entries.push([
							id,
							"viewer",
						]);
					}
				}

				return new Map(entries);
			});

		const [botRoles, blockRoles, assetRoles] = yield* Effect.all(
			[
				roleForAllowedIds("bot", botIds),
				roleForAllowedIds("block", blockIds),
				roleForAllowedIds("asset", assetIds),
			],
			{
				concurrency: "unbounded",
			},
		);

		const effectiveRoleByResource = new Map<string, ResourceGrantRole>();
		for (const [id, role] of botRoles) {
			effectiveRoleByResource.set(`bot:${id}`, role);
		}
		for (const [id, role] of blockRoles) {
			effectiveRoleByResource.set(`block:${id}`, role);
		}
		for (const [id, role] of assetRoles) {
			effectiveRoleByResource.set(`asset:${id}`, role);
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
							eq(dbSchema.groupMember.userId, params.userId),
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

		const groupPrincipalIds = Array.from(
			new Set([
				...groupMemberships.map((membership) => membership.groupId),
				...(allMembersGroup
					? [
							allMembersGroup.id,
						]
					: []),
			]),
		);

		const directGrants = yield* db
			.select({
				resourceType: dbSchema.resourceGrant.resourceType,
				resourceId: dbSchema.resourceGrant.resourceId,
				role: dbSchema.resourceGrant.role,
				principalType: dbSchema.resourceGrant.principalType,
				principalId: dbSchema.resourceGrant.principalId,
				createdAt: dbSchema.resourceGrant.createdAt,
			})
			.from(dbSchema.resourceGrant)
			.where(
				and(
					inArray(dbSchema.resourceGrant.resourceType, resourceTypes),
					inArray(dbSchema.resourceGrant.resourceId, scopedResourceIds),
					isNull(dbSchema.resourceGrant.revokedAt),
					or(
						and(
							eq(dbSchema.resourceGrant.principalType, "user"),
							eq(dbSchema.resourceGrant.principalId, params.userId),
						),
						groupPrincipalIds.length > 0
							? and(
									eq(dbSchema.resourceGrant.principalType, "group"),
									inArray(
										dbSchema.resourceGrant.principalId,
										groupPrincipalIds,
									),
								)
							: undefined,
					),
				),
			);

		const publicEntries = yield* db
			.select({
				resourceType: dbSchema.resourceVisibility.resourceType,
				resourceId: dbSchema.resourceVisibility.resourceId,
				updatedAt: dbSchema.resourceVisibility.updatedAt,
			})
			.from(dbSchema.resourceVisibility)
			.where(
				and(
					eq(dbSchema.resourceVisibility.visibility, "public"),
					inArray(dbSchema.resourceVisibility.resourceType, resourceTypes),
					inArray(dbSchema.resourceVisibility.resourceId, scopedResourceIds),
				),
			);

		const [bots, blocks, assets] = yield* Effect.all(
			[
				botIds.length > 0
					? db
							.select({
								id: dbSchema.bot.id,
								name: dbSchema.bot.name,
							})
							.from(dbSchema.bot)
							.where(inArray(dbSchema.bot.id, botIds))
					: Effect.succeed([]),
				blockIds.length > 0
					? db
							.select({
								id: dbSchema.block.id,
								name: dbSchema.block.name,
							})
							.from(dbSchema.block)
							.where(inArray(dbSchema.block.id, blockIds))
					: Effect.succeed([]),
				assetIds.length > 0
					? db
							.select({
								id: dbSchema.asset.id,
								name: dbSchema.asset.title,
							})
							.from(dbSchema.asset)
							.where(inArray(dbSchema.asset.id, assetIds))
					: Effect.succeed([]),
			],
			{
				concurrency: "unbounded",
			},
		);

		const names = new Map<string, string>();
		for (const item of [
			...bots,
			...blocks,
			...assets,
		]) {
			names.set(item.id, item.name);
		}

		const roleRank = {
			viewer: 1,
			editor: 2,
			manager: 3,
		} as const;

		const directByResource = new Map<
			string,
			{
				role: ResourceGrantRole;
				source: DirectGrantSource;
				createdAt: Date;
			}
		>();

		for (const grant of directGrants) {
			const key = `${grant.resourceType}:${grant.resourceId}`;
			const source =
				grant.principalType === "user"
					? RESOURCE_GRANT_SOURCE.DIRECT_USER
					: grant.principalId === allMembersGroup?.id
						? RESOURCE_GRANT_SOURCE.DIRECT_GROUP_ALL_MEMBERS
						: RESOURCE_GRANT_SOURCE.DIRECT_GROUP;

			const current = directByResource.get(key);
			if (!current || roleRank[grant.role] > roleRank[current.role]) {
				directByResource.set(key, {
					role: grant.role,
					source,
					createdAt: grant.createdAt ?? new Date(0),
				});
			}
		}

		const publicByResource = new Map(
			publicEntries.map((entry) => [
				`${entry.resourceType}:${entry.resourceId}`,
				entry.updatedAt ?? new Date(0),
			]),
		);

		return scopedResources
			.map((resource) => {
				const key = `${resource.resourceType}:${resource.resourceId}`;
				const effectiveRole =
					effectiveRoleByResource.get(key) ?? ("viewer" as const);
				const direct = directByResource.get(key);
				const publicAt = publicByResource.get(key);

				if (direct) {
					return {
						resourceType: resource.resourceType,
						resourceId: resource.resourceId,
						role: effectiveRole,
						source: direct.source,
						resourceName: names.get(resource.resourceId) ?? null,
						createdAt: direct.createdAt,
					};
				}

				if (publicAt) {
					return {
						resourceType: resource.resourceType,
						resourceId: resource.resourceId,
						role: effectiveRole,
						source: RESOURCE_GRANT_SOURCE.PUBLIC,
						resourceName: names.get(resource.resourceId) ?? null,
						createdAt: publicAt,
					};
				}

				return {
					resourceType: resource.resourceType,
					resourceId: resource.resourceId,
					role: effectiveRole,
					source: inheritedSourceByResourceType[resource.resourceType],
					resourceName: names.get(resource.resourceId) ?? null,
					createdAt: new Date(0),
				};
			})
			.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
	});
