import {
	ORGANIZATION_ADMIN_ROLE,
	ORGANIZATION_ROLES,
	type OrganizationId,
} from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import {
	ALL_MEMBERS_GROUP_SYSTEM_KEY,
	type InstanceOrganizationSortKey,
	type OrganizationSortKey,
} from "@orcai/schema";
import { lookupEntitiesByPermission } from "@orcai/spice-db";
import {
	aliasedTable,
	and,
	count,
	desc,
	eq,
	getColumns,
	gt,
	ilike,
	inArray,
	isNull,
	ne,
	notExists,
	sql,
} from "drizzle-orm";
import * as Effect from "effect/Effect";
import {
	AuthzService,
	enqueueRelationshipMutations,
} from "@/lib/effect/services/authz";
import * as AppErrors from "@/lib/effect/utils/errors";
import { authed } from "@/lib/orpc/implementation/authed";
import { requireInstanceAdminMiddleware } from "@/lib/orpc/middlewares/auth";
import { requireEntityPermission } from "@/lib/orpc/middlewares/permission";
import { unique } from "@/lib/utils/array-utils";
import { literalSearch } from "./helpers/literal-search";
import { parseScopedResourceId } from "./helpers/scoped-resource-id";
import { buildOrderBy, type SortExpression } from "./helpers/sorting";

export const listOrganizations = authed.organization.list.effect(function* ({
	input,
	context,
}) {
	const db = yield* DB;
	const authz = yield* AuthzService;

	const memberships = yield* db
		.select({
			organizationId: dbSchema.member.organizationId,
			role: dbSchema.member.role,
		})
		.from(dbSchema.member)
		.where(eq(dbSchema.member.userId, context.auth.user.id));

	const allowedIds = yield* lookupEntitiesByPermission({
		userId: context.auth.user.id,
		permission: "read",
		entityType: "organization",
		zedToken: context.meta?.zedToken,
	}).pipe(
		Effect.map((response) => response.map((item) => item.resourceObjectId)),
		Effect.catch(() => Effect.succeed([])),
	);

	const allowedSet = new Set(allowedIds);
	const roleFilter = input.filters?.role;
	const visibleIds = roleFilter
		? unique(
				memberships
					.filter((membership) => membership.role === roleFilter)
					.map((membership) => membership.organizationId),
			)
		: unique([
				...allowedIds,
				...memberships.map((membership) => membership.organizationId),
			]);

	const missingMemberships = memberships.filter(
		(membership) => !allowedSet.has(membership.organizationId),
	);
	if (missingMemberships.length > 0) {
		yield* authz
			.applyRelationshipMutations({
				mutations: missingMemberships.map((membership) => ({
					resourceType: "organization",
					resourceId: membership.organizationId,
					relation: membership.role,
					subjectType: "user",
					subjectId: context.auth.user.id,
					operation: "touch" as const,
				})),
			})
			.pipe(
				Effect.catch((error) =>
					Effect.logWarning(
						`organization.membership_repair_failed userId=${context.auth.user.id} cause=${String(error)}`,
					),
				),
			);
	}

	if (visibleIds.length === 0) {
		return {
			data: [],
			rowCount: 0,
		};
	}

	const orderBy = yield* buildOrderBy({
		sort: input.sort,
		allowlist: {
			name: dbSchema.organization.name,
			slug: dbSchema.organization.slug,
			createdAt: dbSchema.organization.createdAt,
		} satisfies Record<OrganizationSortKey, SortExpression>,
		defaultOrder: [
			desc(dbSchema.organization.createdAt),
		],
		tieBreaker: {
			id: "id",
			expression: dbSchema.organization.id,
		},
	});

	const search = input.filters?.search?.trim();
	const whereClause = and(
		inArray(dbSchema.organization.id, visibleIds),
		search
			? ilike(dbSchema.organization.name, literalSearch(search))
			: undefined,
	);

	return yield* Effect.all([
		db
			.select()
			.from(dbSchema.organization)
			.where(whereClause)
			.orderBy(...orderBy)
			.limit(input.pageSize)
			.offset(input.pageIndex * input.pageSize),
		db
			.select({
				count: count(),
			})
			.from(dbSchema.organization)
			.where(whereClause),
	]).pipe(
		Effect.map(([organizations, [countResult]]) => ({
			data: organizations,
			rowCount: countResult.count,
		})),
	);
});

export const listAllOrganizations = authed.organization.listAll
	.use(requireInstanceAdminMiddleware)
	.effect(function* ({ input }) {
		const db = yield* DB;
		const memberCount = count(dbSchema.member.id);

		const orderBy = yield* buildOrderBy({
			sort: input.sort,
			allowlist: {
				name: dbSchema.organization.name,
				slug: dbSchema.organization.slug,
				createdAt: dbSchema.organization.createdAt,
				memberCount,
			} satisfies Record<InstanceOrganizationSortKey, SortExpression>,
			defaultOrder: [
				desc(dbSchema.organization.createdAt),
			],
			tieBreaker: {
				id: "id",
				expression: dbSchema.organization.id,
			},
		});

		return yield* Effect.all([
			db
				.select({
					...getColumns(dbSchema.organization),
					memberCount,
				})
				.from(dbSchema.organization)
				.leftJoin(
					dbSchema.member,
					eq(dbSchema.member.organizationId, dbSchema.organization.id),
				)
				.groupBy(dbSchema.organization.id)
				.orderBy(...orderBy)
				.limit(input.pageSize)
				.offset(input.pageIndex * input.pageSize),
			db
				.select({
					count: count(),
				})
				.from(dbSchema.organization),
		]).pipe(
			Effect.map(([organizations, [countResult]]) => ({
				data: organizations.map((organization) => ({
					...organization,
					memberCount: Number(organization.memberCount),
				})),
				rowCount: countResult.count,
			})),
		);
	});

export const findOrganization = authed.organization.find
	.use(
		requireEntityPermission("organization", "read", {
			entityId: "id",
		}),
	)
	.effect(function* ({ input }) {
		const db = yield* DB;

		return yield* db.query.organization
			.findFirst({
				where: {
					id: {
						eq: input.id,
					},
				},
			})
			.pipe(
				Effect.flatMap((organization) =>
					Effect.fromNullishOr(organization).pipe(
						Effect.mapError(
							() =>
								new AppErrors.NotFoundError({
									message: "Organization not found",
								}),
						),
					),
				),
				Effect.map((organization) => ({
					data: organization,
				})),
			);
	});

export const createOrganization = authed.organization.create
	.use(requireInstanceAdminMiddleware)
	.effect(function* ({ input, context }) {
		const db = yield* DB;
		const authz = yield* AuthzService;
		const now = new Date();

		const { organization: newOrganization, allMembersGroupId } =
			yield* db.transaction((tx) =>
				Effect.gen(function* () {
					const [createdOrganization] = yield* tx
						.insert(dbSchema.organization)
						.values({
							...input,
							createdAt: now,
						})
						.returning({
							...getColumns(dbSchema.organization),
						});

					yield* tx.insert(dbSchema.member).values({
						organizationId: createdOrganization.id,
						userId: context.auth.user.id,
						role: ORGANIZATION_ADMIN_ROLE,
						createdAt: now,
					});

					const [allMembersGroup] = yield* tx
						.insert(dbSchema.group)
						.values({
							organizationId: createdOrganization.id,
							name: "All Members",
							description: "System group containing all organization members",
							kind: "system",
							systemKey: ALL_MEMBERS_GROUP_SYSTEM_KEY,
							createdBy: context.auth.user.id,
							createdAt: now,
							updatedAt: now,
							deletedAt: null,
						})
						.returning({
							id: dbSchema.group.id,
						});

					return {
						organization: createdOrganization,
						allMembersGroupId: allMembersGroup.id,
					};
				}),
			);

		yield* authz.applyRelationshipMutations({
			mutations: [
				{
					resourceType: "organization",
					resourceId: newOrganization.id,
					relation: "admin",
					subjectType: "user",
					subjectId: context.auth.user.id,
					operation: "touch",
				},
			],
		});

		yield* authz.applyRelationshipMutations({
			mutations: [
				{
					resourceType: "group",
					resourceId: allMembersGroupId,
					relation: "organization",
					subjectType: "organization",
					subjectId: newOrganization.id,
					operation: "touch",
				},
				{
					resourceType: "group",
					resourceId: allMembersGroupId,
					relation: "member",
					subjectType: "organization",
					subjectId: newOrganization.id,
					subjectRelation: "admin",
					operation: "touch",
				},
				{
					resourceType: "group",
					resourceId: allMembersGroupId,
					relation: "member",
					subjectType: "organization",
					subjectId: newOrganization.id,
					subjectRelation: "manager",
					operation: "touch",
				},
				{
					resourceType: "group",
					resourceId: allMembersGroupId,
					relation: "member",
					subjectType: "organization",
					subjectId: newOrganization.id,
					subjectRelation: "member",
					operation: "touch",
				},
				{
					resourceType: "group",
					resourceId: allMembersGroupId,
					relation: "member",
					subjectType: "organization",
					subjectId: newOrganization.id,
					subjectRelation: "viewer",
					operation: "touch",
				},
			],
		});

		return {
			data: newOrganization,
		};
	});

export const updateOrganization = authed.organization.update
	.use(
		requireEntityPermission("organization", "manage_organization", {
			entityId: "id",
		}),
	)
	.effect(function* ({ input }) {
		const db = yield* DB;

		return yield* db
			.update(dbSchema.organization)
			.set(input)
			.where(eq(dbSchema.organization.id, input.id))
			.returning({
				...getColumns(dbSchema.organization),
			})
			.pipe(
				Effect.map(([query]) => ({
					data: query,
				})),
			);
	});

/** Count resources with no other active organisation scope */
const countExclusiveResources = (organizationId: OrganizationId) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const otherScope = aliasedTable(dbSchema.resourceScope, "other_scope");

		const [result] = yield* db
			.select({
				count: count(),
			})
			.from(dbSchema.resourceScope)
			.where(
				and(
					eq(dbSchema.resourceScope.organizationId, organizationId),
					isNull(dbSchema.resourceScope.endedAt),
					notExists(
						db
							.select({
								one: sql`1`,
							})
							.from(otherScope)
							.where(
								and(
									eq(
										otherScope.resourceType,
										dbSchema.resourceScope.resourceType,
									),
									eq(otherScope.resourceId, dbSchema.resourceScope.resourceId),
									ne(otherScope.organizationId, organizationId),
									isNull(otherScope.endedAt),
								),
							),
					),
				),
			);

		return Number(result?.count ?? 0);
	});

export const getOrganizationDeletionImpact = authed.organization.deletionImpact
	.use(requireInstanceAdminMiddleware)
	.effect(function* ({ input }) {
		const db = yield* DB;
		const now = new Date();

		const [organization] = yield* db
			.select({
				id: dbSchema.organization.id,
				name: dbSchema.organization.name,
				slug: dbSchema.organization.slug,
			})
			.from(dbSchema.organization)
			.where(eq(dbSchema.organization.id, input.id))
			.limit(1);

		if (!organization) {
			return yield* Effect.fail(
				new AppErrors.NotFoundError({
					message: "Organization not found",
				}),
			);
		}

		const [[members], [pendingInvitations], [groups], exclusiveResources] =
			yield* Effect.all(
				[
					db
						.select({
							count: count(),
						})
						.from(dbSchema.member)
						.where(eq(dbSchema.member.organizationId, input.id)),
					db
						.select({
							count: count(),
						})
						.from(dbSchema.invitation)
						.where(
							and(
								eq(dbSchema.invitation.organizationId, input.id),
								eq(dbSchema.invitation.status, "pending"),
								gt(dbSchema.invitation.expiresAt, now),
							),
						),
					db
						.select({
							count: count(),
						})
						.from(dbSchema.group)
						.where(
							and(
								eq(dbSchema.group.organizationId, input.id),
								isNull(dbSchema.group.deletedAt),
							),
						),
					countExclusiveResources(input.id),
				],
				{
					concurrency: "unbounded",
				},
			);

		return {
			data: {
				id: organization.id,
				name: organization.name,
				slug: organization.slug,
				members: Number(members?.count ?? 0),
				pendingInvitations: Number(pendingInvitations?.count ?? 0),
				groups: Number(groups?.count ?? 0),
				exclusiveResources,
			},
		};
	});

/** Reads every tuple the organisation owns before the cascading delete, since SpiceDB cannot list them afterwards. */
export const deleteOrganizations = authed.organization.delete
	.use(requireInstanceAdminMiddleware)
	.effect(function* ({ input }) {
		const db = yield* DB;
		const authz = yield* AuthzService;
		const organizationIds = input.refs.map((ref) => ref.id);
		const now = new Date();

		const eventId = yield* db.transaction((tx) =>
			Effect.gen(function* () {
				const existingOrganizations = yield* tx
					.select({
						id: dbSchema.organization.id,
					})
					.from(dbSchema.organization)
					.where(inArray(dbSchema.organization.id, organizationIds));

				if (existingOrganizations.length !== organizationIds.length) {
					return yield* Effect.fail(
						new AppErrors.NotFoundError({
							message: "One or more organizations were not found",
						}),
					);
				}

				const memberships = yield* tx
					.select({
						organizationId: dbSchema.member.organizationId,
						userId: dbSchema.member.userId,
						role: dbSchema.member.role,
					})
					.from(dbSchema.member)
					.where(inArray(dbSchema.member.organizationId, organizationIds));

				const groups = yield* tx
					.select({
						id: dbSchema.group.id,
						organizationId: dbSchema.group.organizationId,
						systemKey: dbSchema.group.systemKey,
					})
					.from(dbSchema.group)
					.where(
						and(
							inArray(dbSchema.group.organizationId, organizationIds),
							isNull(dbSchema.group.deletedAt),
						),
					);

				const groupIds = groups.map((group) => group.id);

				const groupMembers =
					groupIds.length === 0
						? []
						: yield* tx
								.select({
									groupId: dbSchema.groupMember.groupId,
									userId: dbSchema.groupMember.userId,
								})
								.from(dbSchema.groupMember)
								.where(
									and(
										inArray(dbSchema.groupMember.groupId, groupIds),
										isNull(dbSchema.groupMember.removedAt),
									),
								);

				const groupGrants =
					groupIds.length === 0
						? []
						: yield* tx
								.select({
									resourceType: dbSchema.resourceGrant.resourceType,
									resourceId: dbSchema.resourceGrant.resourceId,
									role: dbSchema.resourceGrant.role,
									principalId: dbSchema.resourceGrant.principalId,
								})
								.from(dbSchema.resourceGrant)
								.where(
									and(
										eq(dbSchema.resourceGrant.principalType, "group"),
										inArray(dbSchema.resourceGrant.principalId, groupIds),
										isNull(dbSchema.resourceGrant.revokedAt),
									),
								);

				if (groupIds.length > 0) {
					yield* tx
						.update(dbSchema.resourceGrant)
						.set({
							revokedAt: now,
						})
						.where(
							and(
								eq(dbSchema.resourceGrant.principalType, "group"),
								inArray(dbSchema.resourceGrant.principalId, groupIds),
								isNull(dbSchema.resourceGrant.revokedAt),
							),
						);
				}

				yield* tx
					.delete(dbSchema.organization)
					.where(inArray(dbSchema.organization.id, organizationIds));

				yield* tx
					.update(dbSchema.session)
					.set({
						activeOrganizationId: null,
					})
					.where(
						inArray(dbSchema.session.activeOrganizationId, organizationIds),
					);

				return yield* enqueueRelationshipMutations({
					tx,
					mutations: [
						...memberships.map((membership) => ({
							resourceType: "organization" as const,
							resourceId: membership.organizationId,
							relation: membership.role,
							subjectType: "user" as const,
							subjectId: membership.userId,
							operation: "delete" as const,
						})),
						...groups.map((group) => ({
							resourceType: "group" as const,
							resourceId: group.id,
							relation: "organization" as const,
							subjectType: "organization" as const,
							subjectId: group.organizationId,
							operation: "delete" as const,
						})),
						...groups
							.filter(
								(group) => group.systemKey === ALL_MEMBERS_GROUP_SYSTEM_KEY,
							)
							.flatMap((group) =>
								ORGANIZATION_ROLES.map((role) => ({
									resourceType: "group" as const,
									resourceId: group.id,
									relation: "member" as const,
									subjectType: "organization" as const,
									subjectId: group.organizationId,
									subjectRelation: role,
									operation: "delete" as const,
								})),
							),
						...groupMembers.map((groupMember) => ({
							resourceType: "group" as const,
							resourceId: groupMember.groupId,
							relation: "member" as const,
							subjectType: "user" as const,
							subjectId: groupMember.userId,
							operation: "delete" as const,
						})),
						...groupGrants.map((grant) => ({
							resourceType: grant.resourceType,
							resourceId: parseScopedResourceId(grant),
							relation: grant.role,
							subjectType: "group" as const,
							subjectId: grant.principalId,
							subjectRelation: "member" as const,
							operation: "delete" as const,
						})),
					],
				});
			}),
		);

		yield* authz
			.deliverRelationshipEvent(eventId)
			.pipe(
				Effect.catch((cause) =>
					Effect.logError(`authz.delivery_failed cause=${String(cause)}`),
				),
			);

		return {
			success: true,
			message: "Organizations deleted successfully",
		};
	});
