import { DB, dbSchema } from "@orcai/db";
import {
	ALL_MEMBERS_GROUP_SYSTEM_KEY,
	assetIdSchema,
	blockIdSchema,
	botIdSchema,
} from "@orcai/schema";
import { and, count, eq, ilike, inArray, isNull, or } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { AuthzService } from "@/lib/effect/services/authz";
import { runOrpcEffect } from "@/lib/effect/utils/orpc-helpers";
import { authed } from "@/lib/orpc/implementation/authed";
import { requireOrganizationPermission } from "@/lib/orpc/middlewares/permission";

const parseScopedResourceId = (resource: {
	resourceType: "asset" | "block" | "bot";
	resourceId: string;
}) => {
	switch (resource.resourceType) {
		case "asset":
			return assetIdSchema.parse(resource.resourceId);
		case "block":
			return blockIdSchema.parse(resource.resourceId);
		case "bot":
			return botIdSchema.parse(resource.resourceId);
	}
};

export const listGroups = authed.group.list
	.use(requireOrganizationPermission("manage_members"))
	.handler(async ({ input, context }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;
				const organizationId = context.auth.session.activeOrganizationId;

				const queryLike = input.filters?.search
					? `%${input.filters.search.trim()}%`
					: undefined;
				const [data, [rowCount]] = yield* Effect.all(
					[
						db
							.select()
							.from(dbSchema.group)
							.where(
								and(
									eq(dbSchema.group.organizationId, organizationId),
									isNull(dbSchema.group.deletedAt),
									queryLike ? ilike(dbSchema.group.name, queryLike) : undefined,
								),
							)
							.limit(input.pageSize)
							.offset(input.pageIndex * input.pageSize),
						db
							.select({
								count: count(),
							})
							.from(dbSchema.group)
							.where(
								and(
									eq(dbSchema.group.organizationId, organizationId),
									isNull(dbSchema.group.deletedAt),
									queryLike ? ilike(dbSchema.group.name, queryLike) : undefined,
								),
							),
					],
					{
						concurrency: "unbounded",
					},
				);

				return {
					data,
					rowCount: rowCount.count,
				};
			}),
		),
	);

export const findGroup = authed.group.find
	.use(requireOrganizationPermission("manage_members"))
	.handler(async ({ input, context, errors }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;
				const organizationId = context.auth.session.activeOrganizationId;

				const [group] = yield* db
					.select()
					.from(dbSchema.group)
					.where(
						and(
							eq(dbSchema.group.id, input.id),
							eq(dbSchema.group.organizationId, organizationId),
							isNull(dbSchema.group.deletedAt),
						),
					)
					.limit(1);

				if (!group) {
					return yield* Effect.fail(
						errors.NOT_FOUND({
							message: "Group not found",
						}),
					);
				}

				return {
					data: group,
				};
			}),
		),
	);

export const createGroup = authed.group.create
	.use(requireOrganizationPermission("manage_members"))
	.handler(async ({ input, context }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;
				const authz = yield* AuthzService;
				const organizationId = context.auth.session.activeOrganizationId;
				const now = new Date();

				const [created] = yield* db
					.insert(dbSchema.group)
					.values({
						organizationId,
						name: input.name,
						description: input.description,
						kind: "custom",
						systemKey: null,
						createdBy: context.auth.user.id,
						createdAt: now,
						updatedAt: now,
						deletedAt: null,
					})
					.returning();

				yield* authz.applyRelationshipMutations({
					mutations: [
						{
							resourceType: "group",
							resourceId: created.id,
							relation: "organization",
							subjectType: "organization",
							subjectId: organizationId,
							operation: "touch",
						},
					],
				});

				return {
					data: created,
				};
			}),
		),
	);

export const updateGroup = authed.group.update
	.use(requireOrganizationPermission("manage_members"))
	.handler(async ({ input, context, errors }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;
				const organizationId = context.auth.session.activeOrganizationId;

				const [existing] = yield* db
					.select({
						id: dbSchema.group.id,
						kind: dbSchema.group.kind,
					})
					.from(dbSchema.group)
					.where(
						and(
							eq(dbSchema.group.id, input.id),
							eq(dbSchema.group.organizationId, organizationId),
							isNull(dbSchema.group.deletedAt),
						),
					)
					.limit(1);

				if (!existing) {
					return yield* Effect.fail(
						errors.NOT_FOUND({
							message: "Group not found",
						}),
					);
				}

				if (existing.kind === "system") {
					return yield* Effect.fail(
						errors.BAD_REQUEST({
							message:
								"[SYSTEM_GROUP_IMMUTABLE] System groups cannot be modified",
						}),
					);
				}

				const [updated] = yield* db
					.update(dbSchema.group)
					.set({
						name: input.name,
						description: input.description,
						updatedAt: new Date(),
					})
					.where(eq(dbSchema.group.id, input.id))
					.returning();

				return {
					data: updated,
				};
			}),
		),
	);

export const deleteGroups = authed.group.delete
	.use(requireOrganizationPermission("manage_members"))
	.handler(async ({ input, context, errors }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;
				const authz = yield* AuthzService;
				const organizationId = context.auth.session.activeOrganizationId;
				const now = new Date();

				const groupIds = input.refs.map((ref) => ref.id);
				if (groupIds.length === 0) {
					return {
						success: true,
						message: "No groups provided",
					};
				}

				const existingGroups = yield* db
					.select({
						id: dbSchema.group.id,
						kind: dbSchema.group.kind,
					})
					.from(dbSchema.group)
					.where(
						and(
							inArray(dbSchema.group.id, groupIds),
							eq(dbSchema.group.organizationId, organizationId),
							isNull(dbSchema.group.deletedAt),
						),
					);

				if (existingGroups.some((group) => group.kind === "system")) {
					return yield* Effect.fail(
						errors.BAD_REQUEST({
							message:
								"[SYSTEM_GROUP_IMMUTABLE] System groups cannot be deleted",
						}),
					);
				}

				const existingGroupIds = existingGroups.map((group) => group.id);
				if (existingGroupIds.length === 0) {
					return {
						success: true,
						message: "No matching groups found",
					};
				}

				const membersToRemove = yield* db
					.select({
						groupId: dbSchema.groupMember.groupId,
						userId: dbSchema.groupMember.userId,
					})
					.from(dbSchema.groupMember)
					.where(
						and(
							inArray(dbSchema.groupMember.groupId, existingGroupIds),
							isNull(dbSchema.groupMember.removedAt),
						),
					);

				const activeGrants = yield* db
					.select({
						id: dbSchema.resourceGrant.id,
						resourceType: dbSchema.resourceGrant.resourceType,
						resourceId: dbSchema.resourceGrant.resourceId,
						role: dbSchema.resourceGrant.role,
						principalId: dbSchema.resourceGrant.principalId,
					})
					.from(dbSchema.resourceGrant)
					.where(
						and(
							eq(dbSchema.resourceGrant.principalType, "group"),
							inArray(dbSchema.resourceGrant.principalId, existingGroupIds),
							isNull(dbSchema.resourceGrant.revokedAt),
						),
					);

				yield* db
					.update(dbSchema.groupMember)
					.set({
						removedAt: now,
					})
					.where(
						and(
							inArray(dbSchema.groupMember.groupId, existingGroupIds),
							isNull(dbSchema.groupMember.removedAt),
						),
					);

				yield* db
					.update(dbSchema.resourceGrant)
					.set({
						revokedAt: now,
					})
					.where(
						and(
							eq(dbSchema.resourceGrant.principalType, "group"),
							inArray(dbSchema.resourceGrant.principalId, existingGroupIds),
							isNull(dbSchema.resourceGrant.revokedAt),
						),
					);

				yield* db
					.update(dbSchema.group)
					.set({
						deletedAt: now,
						updatedAt: now,
					})
					.where(inArray(dbSchema.group.id, existingGroupIds));

				yield* authz.applyRelationshipMutations({
					mutations: [
						...existingGroupIds.map((groupId) => ({
							resourceType: "group" as const,
							resourceId: groupId,
							relation: "organization" as const,
							subjectType: "organization" as const,
							subjectId: organizationId,
							operation: "delete" as const,
						})),
						...membersToRemove.map((member) => ({
							resourceType: "group" as const,
							resourceId: member.groupId,
							relation: "member" as const,
							subjectType: "user" as const,
							subjectId: member.userId,
							operation: "delete" as const,
						})),
						...activeGrants.map((grant) => ({
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

				return {
					success: true,
					message: "Groups deleted successfully",
				};
			}),
		),
	);

export const listGroupMembers = authed.group.listMembers
	.use(requireOrganizationPermission("manage_members"))
	.handler(async ({ input, context, errors }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;
				const organizationId = context.auth.session.activeOrganizationId;

				const [group] = yield* db
					.select({
						id: dbSchema.group.id,
						organizationId: dbSchema.group.organizationId,
						kind: dbSchema.group.kind,
						systemKey: dbSchema.group.systemKey,
					})
					.from(dbSchema.group)
					.where(
						and(
							eq(dbSchema.group.id, input.groupId),
							eq(dbSchema.group.organizationId, organizationId),
							isNull(dbSchema.group.deletedAt),
						),
					)
					.limit(1);

				if (!group) {
					return yield* Effect.fail(
						errors.NOT_FOUND({
							message: "Group not found",
						}),
					);
				}

				const queryLike = input.query ? `%${input.query.trim()}%` : undefined;
				if (
					group.kind === "system" &&
					group.systemKey === ALL_MEMBERS_GROUP_SYSTEM_KEY
				) {
					const [data, [rowCount]] = yield* Effect.all(
						[
							db
								.select({
									user: {
										id: dbSchema.user.id,
										name: dbSchema.user.name,
										email: dbSchema.user.email,
										image: dbSchema.user.image,
									},
								})
								.from(dbSchema.member)
								.innerJoin(
									dbSchema.user,
									eq(dbSchema.user.id, dbSchema.member.userId),
								)
								.where(
									and(
										eq(dbSchema.member.organizationId, organizationId),
										queryLike
											? or(
													ilike(dbSchema.user.name, queryLike),
													ilike(dbSchema.user.email, queryLike),
												)
											: undefined,
									),
								)
								.limit(input.pageSize)
								.offset(input.pageIndex * input.pageSize),
							db
								.select({
									count: count(),
								})
								.from(dbSchema.member)
								.innerJoin(
									dbSchema.user,
									eq(dbSchema.user.id, dbSchema.member.userId),
								)
								.where(
									and(
										eq(dbSchema.member.organizationId, organizationId),
										queryLike
											? or(
													ilike(dbSchema.user.name, queryLike),
													ilike(dbSchema.user.email, queryLike),
												)
											: undefined,
									),
								),
						],
						{
							concurrency: "unbounded",
						},
					);

					return {
						data: data.map((row) => ({
							user: row.user,
							source: "implicit" as const,
							addedAt: null,
							addedBy: null,
						})),
						rowCount: rowCount.count,
					};
				}

				const [data, [rowCount]] = yield* Effect.all(
					[
						db
							.select({
								user: {
									id: dbSchema.user.id,
									name: dbSchema.user.name,
									email: dbSchema.user.email,
									image: dbSchema.user.image,
								},
								addedAt: dbSchema.groupMember.createdAt,
								addedBy: dbSchema.groupMember.addedBy,
							})
							.from(dbSchema.groupMember)
							.innerJoin(
								dbSchema.user,
								eq(dbSchema.user.id, dbSchema.groupMember.userId),
							)
							.where(
								and(
									eq(dbSchema.groupMember.groupId, group.id),
									isNull(dbSchema.groupMember.removedAt),
									queryLike
										? or(
												ilike(dbSchema.user.name, queryLike),
												ilike(dbSchema.user.email, queryLike),
											)
										: undefined,
								),
							)
							.limit(input.pageSize)
							.offset(input.pageIndex * input.pageSize),
						db
							.select({
								count: count(),
							})
							.from(dbSchema.groupMember)
							.innerJoin(
								dbSchema.user,
								eq(dbSchema.user.id, dbSchema.groupMember.userId),
							)
							.where(
								and(
									eq(dbSchema.groupMember.groupId, group.id),
									isNull(dbSchema.groupMember.removedAt),
									queryLike
										? or(
												ilike(dbSchema.user.name, queryLike),
												ilike(dbSchema.user.email, queryLike),
											)
										: undefined,
								),
							),
					],
					{
						concurrency: "unbounded",
					},
				);

				return {
					data: data.map((row) => ({
						user: row.user,
						source: "explicit" as const,
						addedAt: row.addedAt,
						addedBy: row.addedBy,
					})),
					rowCount: rowCount.count,
				};
			}),
		),
	);

export const addGroupMembers = authed.group.addMembers
	.use(requireOrganizationPermission("manage_members"))
	.handler(async ({ input, context, errors }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;
				const authz = yield* AuthzService;
				const organizationId = context.auth.session.activeOrganizationId;
				const now = new Date();

				const [group] = yield* db
					.select({
						id: dbSchema.group.id,
						kind: dbSchema.group.kind,
					})
					.from(dbSchema.group)
					.where(
						and(
							eq(dbSchema.group.id, input.groupId),
							eq(dbSchema.group.organizationId, organizationId),
							isNull(dbSchema.group.deletedAt),
						),
					)
					.limit(1);

				if (!group) {
					return yield* Effect.fail(
						errors.NOT_FOUND({
							message: "Group not found",
						}),
					);
				}
				if (group.kind === "system") {
					return yield* Effect.fail(
						errors.BAD_REQUEST({
							message:
								"[SYSTEM_GROUP_IMMUTABLE] System groups cannot be modified",
						}),
					);
				}

				const members = yield* db
					.select({
						userId: dbSchema.member.userId,
					})
					.from(dbSchema.member)
					.where(
						and(
							eq(dbSchema.member.organizationId, organizationId),
							inArray(dbSchema.member.userId, input.userIds),
						),
					);

				const validUserIds = new Set(members.map((item) => item.userId));
				if (validUserIds.size !== new Set(input.userIds).size) {
					return yield* Effect.fail(
						errors.BAD_REQUEST({
							message:
								"[CROSS_ORG_PRINCIPAL_FORBIDDEN] Group members must belong to the same organization",
						}),
					);
				}

				const existing = yield* db
					.select({
						id: dbSchema.groupMember.id,
						userId: dbSchema.groupMember.userId,
						removedAt: dbSchema.groupMember.removedAt,
					})
					.from(dbSchema.groupMember)
					.where(
						and(
							eq(dbSchema.groupMember.groupId, input.groupId),
							inArray(dbSchema.groupMember.userId, input.userIds),
						),
					);

				const existingByUserId = new Map(
					existing.map((row) => [
						row.userId,
						row,
					]),
				);
				const toInsert = input.userIds.filter(
					(userId) => !existingByUserId.has(userId),
				);
				const toRestore = input.userIds.filter(
					(userId) => existingByUserId.get(userId)?.removedAt !== null,
				);
				const toTouch = new Set([
					...toInsert,
					...toRestore,
					...input.userIds.filter(
						(userId) => existingByUserId.get(userId)?.removedAt === null,
					),
				]);

				if (toRestore.length > 0) {
					yield* db
						.update(dbSchema.groupMember)
						.set({
							removedAt: null,
							addedBy: context.auth.user.id,
							createdAt: now,
						})
						.where(
							and(
								eq(dbSchema.groupMember.groupId, input.groupId),
								inArray(dbSchema.groupMember.userId, toRestore),
							),
						);
				}

				if (toInsert.length > 0) {
					yield* db.insert(dbSchema.groupMember).values(
						toInsert.map((userId) => ({
							groupId: input.groupId,
							userId,
							addedBy: context.auth.user.id,
							createdAt: now,
							removedAt: null,
						})),
					);
				}

				yield* authz.applyRelationshipMutations({
					mutations: Array.from(toTouch).map((userId) => ({
						resourceType: "group" as const,
						resourceId: input.groupId,
						relation: "member" as const,
						subjectType: "user" as const,
						subjectId: userId,
						operation: "touch" as const,
					})),
				});

				return {
					success: true,
					message: "Group members updated successfully",
				};
			}),
		),
	);

export const removeGroupMembers = authed.group.removeMembers
	.use(requireOrganizationPermission("manage_members"))
	.handler(async ({ input, context, errors }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;
				const authz = yield* AuthzService;

				const organizationId = context.auth.session.activeOrganizationId;
				const now = new Date();

				const [group] = yield* db
					.select({
						id: dbSchema.group.id,
						kind: dbSchema.group.kind,
					})
					.from(dbSchema.group)
					.where(
						and(
							eq(dbSchema.group.id, input.groupId),
							eq(dbSchema.group.organizationId, organizationId),
							isNull(dbSchema.group.deletedAt),
						),
					)
					.limit(1);

				if (!group) {
					return yield* Effect.fail(
						errors.NOT_FOUND({
							message: "Group not found",
						}),
					);
				}
				if (group.kind === "system") {
					return yield* Effect.fail(
						errors.BAD_REQUEST({
							message:
								"[SYSTEM_GROUP_IMMUTABLE] System groups cannot be modified",
						}),
					);
				}

				const activeMembers = yield* db
					.select({
						userId: dbSchema.groupMember.userId,
					})
					.from(dbSchema.groupMember)
					.where(
						and(
							eq(dbSchema.groupMember.groupId, input.groupId),
							inArray(dbSchema.groupMember.userId, input.userIds),
							isNull(dbSchema.groupMember.removedAt),
						),
					);

				if (activeMembers.length === 0) {
					return {
						success: true,
						message: "No active members to remove",
					};
				}

				yield* db
					.update(dbSchema.groupMember)
					.set({
						removedAt: now,
					})
					.where(
						and(
							eq(dbSchema.groupMember.groupId, input.groupId),
							inArray(
								dbSchema.groupMember.userId,
								activeMembers.map((member) => member.userId),
							),
							isNull(dbSchema.groupMember.removedAt),
						),
					);

				yield* authz.applyRelationshipMutations({
					mutations: activeMembers.map((member) => ({
						resourceType: "group" as const,
						resourceId: input.groupId,
						relation: "member" as const,
						subjectType: "user" as const,
						subjectId: member.userId,
						operation: "delete" as const,
					})),
				});

				return {
					success: true,
					message: "Group members removed successfully",
				};
			}),
		),
	);
