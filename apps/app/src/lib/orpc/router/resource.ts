import { DB, dbSchema } from "@orcai/db";
import type {
	ResourceGrantRole,
	ResourceGrant as ResourceGrantView,
	ResourcePrincipal,
} from "@orcai/schema";
import {
	ALL_MEMBERS_GROUP_SYSTEM_KEY,
	assetIdSchema,
	blockIdSchema,
	botIdSchema,
	groupIdSchema,
	RESOURCE_GRANT_SOURCE,
	userIdSchema,
} from "@orcai/schema";
import type { TupleMutation } from "@orcai/spice-db";
import { and, count, desc, eq, ilike, inArray, isNull, or } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { AuthzService } from "@/lib/effect/services/authz";
import * as AppErrors from "@/lib/effect/utils/errors";
import { authed } from "@/lib/orpc/implementation/authed";
import {
	assertCanGrantPrincipalMiddleware,
	requireResourcePermission,
} from "@/lib/orpc/middlewares/permission";

type GroupPrincipal = Extract<
	ResourcePrincipal,
	{
		type: "group";
	}
>;

const roleToRelation = (role: ResourceGrantRole) => role;

const grantSourceForGroup = (
	params: Pick<GroupPrincipal, "kind" | "systemKey">,
) =>
	params.kind === "system" && params.systemKey === ALL_MEMBERS_GROUP_SYSTEM_KEY
		? RESOURCE_GRANT_SOURCE.DIRECT_GROUP_ALL_MEMBERS
		: RESOURCE_GRANT_SOURCE.DIRECT_GROUP;

const parseResourceIdentity = (resource: {
	resourceType: ResourceGrantView["resourceType"];
	resourceId: string;
}) => {
	switch (resource.resourceType) {
		case "asset":
			return {
				resourceType: "asset" as const,
				resourceId: assetIdSchema.parse(resource.resourceId),
			};
		case "block":
			return {
				resourceType: "block" as const,
				resourceId: blockIdSchema.parse(resource.resourceId),
			};
		case "bot":
			return {
				resourceType: "bot" as const,
				resourceId: botIdSchema.parse(resource.resourceId),
			};
	}
};

export const listResourceGrants = authed.resource.listGrants
	.use(requireResourcePermission("manage_access"))
	.effect(function* ({ input }) {
		const db = yield* DB;
		const grants = yield* db
			.select()
			.from(dbSchema.resourceGrant)
			.where(
				and(
					eq(dbSchema.resourceGrant.resourceType, input.resourceType),
					eq(dbSchema.resourceGrant.resourceId, input.resourceId),
					isNull(dbSchema.resourceGrant.revokedAt),
				),
			);

		if (grants.length === 0) {
			return {
				data: [],
				rowCount: 0,
			};
		}

		const userIds = userIdSchema
			.array()
			.parse(
				grants
					.filter((grant) => grant.principalType === "user")
					.map((grant) => grant.principalId),
			);
		const groupIds = groupIdSchema
			.array()
			.parse(
				grants
					.filter((grant) => grant.principalType === "group")
					.map((grant) => grant.principalId),
			);

		const users =
			userIds.length > 0
				? yield* db
						.select({
							id: dbSchema.user.id,
							name: dbSchema.user.name,
							email: dbSchema.user.email,
							image: dbSchema.user.image,
						})
						.from(dbSchema.user)
						.where(inArray(dbSchema.user.id, userIds))
				: [];
		const groups =
			groupIds.length > 0
				? yield* db
						.select({
							id: dbSchema.group.id,
							name: dbSchema.group.name,
							description: dbSchema.group.description,
							kind: dbSchema.group.kind,
							systemKey: dbSchema.group.systemKey,
							organizationId: dbSchema.group.organizationId,
						})
						.from(dbSchema.group)
						.where(
							and(
								inArray(dbSchema.group.id, groupIds),
								isNull(dbSchema.group.deletedAt),
							),
						)
				: [];

		const userById = new Map(
			users.map((user) => [
				user.id,
				user,
			]),
		);
		const groupById = new Map(
			groups.map((group) => [
				group.id,
				group,
			]),
		);

		const data: ResourceGrantView[] = [];
		for (const grant of grants) {
			const resourceIdentity = parseResourceIdentity(grant);

			if (grant.principalType === "user") {
				const principalId = userIdSchema.parse(grant.principalId);
				const principal = userById.get(principalId);
				if (!principal) {
					continue;
				}

				data.push({
					...grant,
					...resourceIdentity,
					principal: {
						type: "user",
						...principal,
					},
					source: "direct:user",
				});
				continue;
			}

			const principalId = groupIdSchema.parse(grant.principalId);
			const principal = groupById.get(principalId);
			if (!principal) {
				continue;
			}

			data.push({
				...grant,
				...resourceIdentity,
				principal: {
					type: "group",
					...principal,
				},
				source: grantSourceForGroup(principal),
			});
		}

		return {
			data,
			rowCount: data.length,
		};
	});

export const listResourcePrincipals = authed.resource.listPrincipals
	.use(requireResourcePermission("manage_access"))
	.effect(function* ({ input }) {
		const db = yield* DB;
		const scopes = yield* db
			.select({
				organizationId: dbSchema.resourceScope.organizationId,
			})
			.from(dbSchema.resourceScope)
			.where(
				and(
					eq(dbSchema.resourceScope.resourceType, input.resourceType),
					eq(dbSchema.resourceScope.resourceId, input.resourceId),
					isNull(dbSchema.resourceScope.endedAt),
				),
			);

		if (scopes.length === 0) {
			return {
				data: [],
				rowCount: 0,
			};
		}

		const orgIds = scopes.map((scope) => scope.organizationId);
		const query = input.query?.trim();
		const searchLike = query ? `%${query}%` : undefined;

		const users =
			!input.principalType || input.principalType === "user"
				? yield* db
						.selectDistinct({
							id: dbSchema.user.id,
							name: dbSchema.user.name,
							email: dbSchema.user.email,
							image: dbSchema.user.image,
						})
						.from(dbSchema.member)
						.innerJoin(
							dbSchema.user,
							eq(dbSchema.user.id, dbSchema.member.userId),
						)
						.where(
							and(
								inArray(dbSchema.member.organizationId, orgIds),
								searchLike
									? or(
											ilike(dbSchema.user.name, searchLike),
											ilike(dbSchema.user.email, searchLike),
										)
									: undefined,
							),
						)
						.limit(input.limit)
				: [];

		const groups =
			!input.principalType || input.principalType === "group"
				? yield* db
						.select({
							id: dbSchema.group.id,
							name: dbSchema.group.name,
							description: dbSchema.group.description,
							kind: dbSchema.group.kind,
							systemKey: dbSchema.group.systemKey,
							organizationId: dbSchema.group.organizationId,
						})
						.from(dbSchema.group)
						.where(
							and(
								inArray(dbSchema.group.organizationId, orgIds),
								isNull(dbSchema.group.deletedAt),
								searchLike ? ilike(dbSchema.group.name, searchLike) : undefined,
							),
						)
						.orderBy(desc(dbSchema.group.kind), dbSchema.group.name)
						.limit(input.limit)
				: [];

		const principals: ResourcePrincipal[] = [
			...users.map((user) => ({
				type: "user" as const,
				...user,
			})),
			...groups.map((group) => ({
				type: "group" as const,
				...group,
			})),
		].slice(0, input.limit);

		return {
			data: principals,
			rowCount: principals.length,
		};
	});

export const grantResourceAccess = authed.resource.grant
	.use(assertCanGrantPrincipalMiddleware)
	.effect(function* ({ input, context }) {
		const db = yield* DB;
		const authz = yield* AuthzService;

		const [existingGrant] = yield* db
			.select()
			.from(dbSchema.resourceGrant)
			.where(
				and(
					eq(dbSchema.resourceGrant.resourceType, input.resourceType),
					eq(dbSchema.resourceGrant.resourceId, input.resourceId),
					eq(dbSchema.resourceGrant.principalType, input.principalType),
					eq(dbSchema.resourceGrant.principalId, input.principalId),
					isNull(dbSchema.resourceGrant.revokedAt),
				),
			)
			.limit(1);

		if (existingGrant?.role === "manager" && input.role !== "manager") {
			const [managerCount] = yield* db
				.select({
					count: count(),
				})
				.from(dbSchema.resourceGrant)
				.where(
					and(
						eq(dbSchema.resourceGrant.resourceType, input.resourceType),
						eq(dbSchema.resourceGrant.resourceId, input.resourceId),
						eq(dbSchema.resourceGrant.role, "manager"),
						isNull(dbSchema.resourceGrant.revokedAt),
					),
				);

			if (Number(managerCount.count) <= 1) {
				return yield* Effect.fail(
					new AppErrors.BadRequestError({
						message: "At least one manager must remain on this resource",
						data: {
							code: "LAST_MANAGER_REQUIRED",
						},
					}),
				);
			}
		}

		const now = new Date();
		if (existingGrant) {
			yield* db
				.update(dbSchema.resourceGrant)
				.set({
					revokedAt: now,
				})
				.where(eq(dbSchema.resourceGrant.id, existingGrant.id));
		}

		const [grant] = yield* db
			.insert(dbSchema.resourceGrant)
			.values({
				resourceType: input.resourceType,
				resourceId: input.resourceId,
				principalType: input.principalType,
				principalId: input.principalId,
				role: input.role,
				grantedBy: context.auth.user.id,
				createdAt: now,
				revokedAt: null,
			})
			.returning();

		const principal: ResourcePrincipal | null =
			input.principalType === "user"
				? yield* db
						.select({
							id: dbSchema.user.id,
							name: dbSchema.user.name,
							email: dbSchema.user.email,
							image: dbSchema.user.image,
						})
						.from(dbSchema.user)
						.where(eq(dbSchema.user.id, input.principalId))
						.limit(1)
						.pipe(
							Effect.map(([user]) =>
								user
									? {
											type: "user" as const,
											...user,
										}
									: null,
							),
						)
				: yield* db
						.select({
							id: dbSchema.group.id,
							name: dbSchema.group.name,
							description: dbSchema.group.description,
							kind: dbSchema.group.kind,
							systemKey: dbSchema.group.systemKey,
							organizationId: dbSchema.group.organizationId,
						})
						.from(dbSchema.group)
						.where(
							and(
								eq(dbSchema.group.id, input.principalId),
								isNull(dbSchema.group.deletedAt),
							),
						)
						.limit(1)
						.pipe(
							Effect.map(([group]) =>
								group
									? {
											type: "group" as const,
											...group,
										}
									: null,
							),
						);

		if (!principal) {
			return yield* Effect.fail(
				new AppErrors.NotFoundError({
					message:
						input.principalType === "user"
							? "User principal not found"
							: "Group principal not found",
				}),
			);
		}

		const mutations: TupleMutation[] = [];
		if (
			existingGrant &&
			existingGrant.role !== input.role &&
			existingGrant.resourceType === input.resourceType
		) {
			mutations.push({
				resourceType: input.resourceType,
				resourceId: input.resourceId,
				relation: roleToRelation(existingGrant.role),
				subjectType: input.principalType,
				subjectId: input.principalId,
				subjectRelation: input.principalType === "group" ? "member" : undefined,
				operation: "delete",
			});
		}

		mutations.push({
			resourceType: input.resourceType,
			resourceId: input.resourceId,
			relation: roleToRelation(input.role),
			subjectType: input.principalType,
			subjectId: input.principalId,
			subjectRelation: input.principalType === "group" ? "member" : undefined,
			operation: "touch",
		});

		const relation = yield* authz.applyRelationshipMutations({
			mutations,
		});
		const source =
			principal.type === "user"
				? ("direct:user" as const)
				: grantSourceForGroup(principal);

		return {
			data: {
				...grant,
				principal,
				source,
			},
			meta: {
				zedToken: relation.zedToken,
			},
		};
	});

export const revokeResourceAccess = authed.resource.revoke
	.use(requireResourcePermission("manage_access"))
	.effect(function* ({ input }) {
		const db = yield* DB;
		const authz = yield* AuthzService;

		const activeGrants = yield* db
			.select()
			.from(dbSchema.resourceGrant)
			.where(
				and(
					eq(dbSchema.resourceGrant.resourceType, input.resourceType),
					eq(dbSchema.resourceGrant.resourceId, input.resourceId),
					eq(dbSchema.resourceGrant.principalType, input.principalType),
					eq(dbSchema.resourceGrant.principalId, input.principalId),
					isNull(dbSchema.resourceGrant.revokedAt),
				),
			);

		if (activeGrants.length === 0) {
			return {
				success: true,
				message: "No active grant to revoke",
			};
		}

		const revokingManager = activeGrants.some(
			(grant) => grant.role === "manager",
		);

		if (revokingManager) {
			const [managerCount] = yield* db
				.select({
					count: count(),
				})
				.from(dbSchema.resourceGrant)
				.where(
					and(
						eq(dbSchema.resourceGrant.resourceType, input.resourceType),
						eq(dbSchema.resourceGrant.resourceId, input.resourceId),
						eq(dbSchema.resourceGrant.role, "manager"),
						isNull(dbSchema.resourceGrant.revokedAt),
					),
				);

			if (Number(managerCount.count) <= 1) {
				return yield* Effect.fail(
					new AppErrors.BadRequestError({
						message: "At least one manager must remain on this resource",
						data: {
							code: "LAST_MANAGER_REQUIRED",
						},
					}),
				);
			}
		}

		yield* db
			.update(dbSchema.resourceGrant)
			.set({
				revokedAt: new Date(),
			})
			.where(
				and(
					eq(dbSchema.resourceGrant.resourceType, input.resourceType),
					eq(dbSchema.resourceGrant.resourceId, input.resourceId),
					eq(dbSchema.resourceGrant.principalType, input.principalType),
					eq(dbSchema.resourceGrant.principalId, input.principalId),
					isNull(dbSchema.resourceGrant.revokedAt),
				),
			);

		yield* authz.applyRelationshipMutations({
			mutations: activeGrants.map((grant) => ({
				resourceType: input.resourceType,
				resourceId: input.resourceId,
				relation: roleToRelation(grant.role),
				subjectType: input.principalType,
				subjectId: input.principalId,
				subjectRelation: input.principalType === "group" ? "member" : undefined,
				operation: "delete" as const,
			})),
		});

		return {
			success: true,
			message: "Access revoked successfully",
		};
	});

export const getResourceVisibility = authed.resource.getVisibility
	.use(requireResourcePermission("read"))
	.effect(function* ({ input }) {
		const db = yield* DB;

		const [existing] = yield* db
			.select()
			.from(dbSchema.resourceVisibility)
			.where(
				and(
					eq(dbSchema.resourceVisibility.resourceType, input.resourceType),
					eq(dbSchema.resourceVisibility.resourceId, input.resourceId),
				),
			)
			.limit(1);

		return {
			data: {
				resourceType: input.resourceType,
				resourceId: input.resourceId,
				visibility: existing?.visibility ?? "private",
			},
		};
	});

export const setResourceVisibility = authed.resource.setVisibility
	.use(requireResourcePermission("manage_access"))
	.effect(function* ({ input, context }) {
		const db = yield* DB;
		const authz = yield* AuthzService;
		const now = new Date();

		const [existing] = yield* db
			.select()
			.from(dbSchema.resourceVisibility)
			.where(
				and(
					eq(dbSchema.resourceVisibility.resourceType, input.resourceType),
					eq(dbSchema.resourceVisibility.resourceId, input.resourceId),
				),
			)
			.limit(1);

		const [data] = existing
			? yield* db
					.update(dbSchema.resourceVisibility)
					.set({
						visibility: input.visibility,
						updatedAt: now,
						updatedBy: context.auth.user.id,
					})
					.where(eq(dbSchema.resourceVisibility.id, existing.id))
					.returning()
			: yield* db
					.insert(dbSchema.resourceVisibility)
					.values({
						resourceType: input.resourceType,
						resourceId: input.resourceId,
						visibility: input.visibility,
						updatedBy: context.auth.user.id,
						updatedAt: now,
					})
					.returning();

		const relation = yield* authz.applyRelationshipMutations({
			mutations: [
				{
					resourceType: input.resourceType,
					resourceId: input.resourceId,
					relation: "public",
					subjectType: "user",
					subjectId: "*",
					operation: input.visibility === "public" ? "touch" : "delete",
				},
			],
		});

		return {
			data,
			meta: {
				zedToken: relation.zedToken,
			},
		};
	});
