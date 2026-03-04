import { count, eq, getColumns, inArray } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { dbSchema } from "@/db/schema";
import { AuthzService } from "@/lib/effect/services/authz";
import { DB } from "@/lib/effect/services/drizzle";
import { runOrpcEffect } from "@/lib/effect/utils/orpc-helpers";
import { authed } from "@/lib/orpc/implementation/authed";
import { requireActiveOrganizationMiddleware } from "@/lib/orpc/middlewares/auth";
import {
	type CheckManyPermissionInput,
	type CheckPermissionInput,
	checkManyPermissionMiddleware,
	checkPermissionMiddleware,
} from "@/lib/orpc/middlewares/permission";
import { ALL_MEMBERS_GROUP_SYSTEM_KEY } from "@/lib/orpc/schemas/resource";
import { lookupEntitiesByPermission } from "@/lib/spice-db/client";
import { unique } from "@/lib/utils/array-utils";

export const listOrganizations = authed.organization.list.handler(
	async ({ input, context }) =>
		runOrpcEffect(
			Effect.gen(function* () {
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
					Effect.map((response) =>
						response.map((item) => item.resourceObjectId),
					),
					Effect.catchAll(() => Effect.succeed([])),
				);

				const allowedSet = new Set(allowedIds);
				const visibleIds = unique([
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
							Effect.catchAll((error) =>
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

				return yield* Effect.all([
					db.query.organization.findMany({
						where: {
							id: {
								in: visibleIds,
							},
						},
						orderBy: {
							createdAt: "desc",
						},
						limit: input.pageSize,
						offset: input.pageIndex * input.pageSize,
					}),
					db
						.select({
							count: count(),
						})
						.from(dbSchema.organization)
						.where(inArray(dbSchema.organization.id, visibleIds)),
				]).pipe(
					Effect.map(([organizations, [countResult]]) => ({
						data: organizations,
						rowCount: countResult.count,
					})),
				);
			}),
		),
);

export const findOrganization = authed.organization.find
	.use(
		checkPermissionMiddleware,
		(input) =>
			({
				entityId: input.id,
				permission: "read",
				entityType: "organization",
			}) satisfies CheckPermissionInput,
	)
	.handler(async ({ input, errors }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;

				return yield* db.query.organization
					.findFirst({
						where: {
							id: input.id,
						},
					})
					.pipe(
						Effect.flatMap((organization) =>
							Effect.fromNullable(organization).pipe(
								Effect.orElse(() =>
									Effect.fail(
										errors.NOT_FOUND({
											message: "Organization not found",
										}),
									),
								),
							),
						),
						Effect.map((chat) => ({
							data: chat,
						})),
					);
			}),
		),
	);

export const createOrganization = authed.organization.create
	.use(requireActiveOrganizationMiddleware)
	.handler(async ({ input, context }) =>
		runOrpcEffect(
			Effect.gen(function* () {
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
								role: "owner",
								createdAt: now,
							});

							const [allMembersGroup] = yield* tx
								.insert(dbSchema.group)
								.values({
									organizationId: createdOrganization.id,
									name: "All Members",
									description:
										"System group containing all organization members",
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
							relation: "owner",
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
							subjectRelation: "owner",
							operation: "touch",
						},
						{
							resourceType: "group",
							resourceId: allMembersGroupId,
							relation: "member",
							subjectType: "organization",
							subjectId: newOrganization.id,
							subjectRelation: "instructor",
							operation: "touch",
						},
						{
							resourceType: "group",
							resourceId: allMembersGroupId,
							relation: "member",
							subjectType: "organization",
							subjectId: newOrganization.id,
							subjectRelation: "student",
							operation: "touch",
						},
					],
				});

				return {
					data: newOrganization,
				};
			}),
		),
	);

export const updateOrganization = authed.organization.update
	.use(
		checkPermissionMiddleware,
		(input) =>
			({
				entityId: input.id,
				permission: "manage_members",
				entityType: "organization",
			}) satisfies CheckPermissionInput,
	)
	.handler(async ({ input }) =>
		runOrpcEffect(
			Effect.gen(function* () {
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
			}),
		),
	);

export const deleteOrganizations = authed.organization.delete
	.use(
		checkManyPermissionMiddleware,
		(input) =>
			({
				entityIds: input.refs.map((ref) => ref.id),
				permission: "manage_members",
				entityType: "organization",
			}) satisfies CheckManyPermissionInput,
	)
	.handler(async ({ context }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;

				yield* db
					.delete(dbSchema.organization)
					.where(inArray(dbSchema.organization.id, context.allowedIds));

				return {
					success: true,
					message: "Organizations deleted successfully",
				};
			}),
		),
	);
