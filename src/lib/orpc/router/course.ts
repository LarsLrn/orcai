import { v1 } from "@authzed/authzed-node";
import { and, count, eq, getColumns, inArray, isNull } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { dbSchema } from "@/db/schema";
import { initializeResourceAuthorization } from "@/lib/authz/resource-lifecycle";
import { AuthzService } from "@/lib/effect/services/authz";
import { DB } from "@/lib/effect/services/drizzle";
import { runOrpcEffect } from "@/lib/effect/utils/orpc-helpers";
import { authed } from "@/lib/orpc/implementation/authed";
import { requireOrganizationPermission } from "@/lib/orpc/middlewares/org-permission";
import {
	type CheckManyPermissionInput,
	type CheckPermissionInput,
	checkManyPermissionMiddleware,
	checkPermissionMiddleware,
} from "@/lib/orpc/middlewares/permission";
import {
	checkEntityPermission,
	lookupEntitiesByPermission,
} from "@/lib/spice-db/client";

export const listCourses = authed.course.list.handler(
	async ({ input, context }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;

				const allowedIds = yield* lookupEntitiesByPermission({
					userId: context.auth.user.id,
					permission: "read",
					entityType: "course",
					zedToken: input.zedToken,
				}).pipe(
					Effect.map((response) =>
						response.map((item) => item.resourceObjectId),
					),
				);

				return yield* Effect.all(
					[
						db
							.select({ ...getColumns(dbSchema.course) })
							.from(dbSchema.course)
							.where(inArray(dbSchema.course.id, allowedIds))
							.limit(input.pageSize)
							.offset(input.pageIndex * input.pageSize),
						db
							.select({ count: count() })
							.from(dbSchema.course)
							.where(inArray(dbSchema.course.id, allowedIds)),
					],
					{ concurrency: "unbounded" },
				).pipe(
					Effect.map(([data, [countResult]]) => ({
						data,
						rowCount: countResult.count,
					})),
				);
			}),
		),
);

export const findCourse = authed.course.find
	.use(
		checkPermissionMiddleware,
		(input) =>
			({
				entityId: input.id,
				permission: "read",
				entityType: "course",
				zedToken: input.zedToken,
			}) satisfies CheckPermissionInput,
	)
	.handler(async ({ input, errors }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;

				const [query] = yield* db
					.select({ ...getColumns(dbSchema.course) })
					.from(dbSchema.course)
					.where(eq(dbSchema.course.id, input.id));

				if (!query) {
					return yield* Effect.fail(
						errors.NOT_FOUND({ message: "Course not found" }),
					);
				}

				return { data: query };
			}),
		),
	);

export const createCourse = authed.course.create
	.use(requireOrganizationPermission("create_course"))
	.handler(async ({ input, context }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;
				const organizationId = context.auth.session.activeOrganizationId;

				const [query] = yield* db
					.insert(dbSchema.course)
					.values({
						title: input.title,
						description: input.description,
						contentJson: input.contentJson,
						contentHtml: input.contentHtml,
						organizationId,
						config: input.config,
					})
					.returning({ ...getColumns(dbSchema.course) });

				const relationResult = yield* initializeResourceAuthorization({
					resourceType: "course",
					resourceId: query.id,
					organizationId,
					ownerUserId: context.auth.user.id,
				});

				return {
					data: query,
					meta: { zedToken: relationResult.zedToken },
				};
			}),
		),
	);

export const updateCourse = authed.course.update
	.use(
		checkPermissionMiddleware,
		(input) =>
			({
				entityId: input.id,
				permission: "edit",
				entityType: "course",
			}) satisfies CheckPermissionInput,
	)
	.handler(async ({ input }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;

				const [query] = yield* db
					.update(dbSchema.course)
					.set({
						contentJson: input.contentJson,
						contentHtml: input.contentHtml,
						title: input.title,
						description: input.description,
						config: input.config,
						updatedAt: new Date(),
					})
					.where(eq(dbSchema.course.id, input.id))
					.returning({ ...getColumns(dbSchema.course) });

				return { data: query };
			}),
		),
	);

export const deleteCourses = authed.course.delete
	.use(
		checkManyPermissionMiddleware,
		(input) =>
			({
				entityIds: input.refs.map((ref) => ref.id),
				permission: "delete",
				entityType: "course",
			}) satisfies CheckManyPermissionInput,
	)
	.handler(async ({ context }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;

				// Check if there are any IDs to delete
				if (!context.allowedIds || context.allowedIds.length === 0) {
					return { success: true, message: "No courses to delete" };
				}

				yield* db
					.delete(dbSchema.course)
					.where(inArray(dbSchema.course.id, context.allowedIds));

				return { success: true, message: "Courses deleted successfully" };
			}),
		),
	);

export const listCourseBots = authed.course.listBots
	.use(
		checkPermissionMiddleware,
		(input) =>
			({
				entityId: input.courseId,
				permission: "read",
				entityType: "course",
			}) satisfies CheckPermissionInput,
	)
	.handler(async ({ input }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;

				const data = yield* db
					.select({ ...getColumns(dbSchema.bot) })
					.from(dbSchema.courseBot)
					.innerJoin(
						dbSchema.bot,
						eq(dbSchema.courseBot.botId, dbSchema.bot.id),
					)
					.where(eq(dbSchema.courseBot.courseId, input.courseId));

				return { data, rowCount: data.length };
			}),
		),
	);

export const attachCourseBot = authed.course.attachBot
	.use(
		checkPermissionMiddleware,
		(input) =>
			({
				entityId: input.courseId,
				permission: "manage",
				entityType: "course",
			}) satisfies CheckPermissionInput,
	)
	.handler(async ({ input, context, errors }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;
				const authz = yield* AuthzService;

				const canManageAccess = yield* checkEntityPermission({
					entityId: input.botId,
					entityType: "bot",
					permission: "manage_access",
					userId: context.auth.user.id,
					zedToken: context.meta?.zedToken,
				});

				const canEdit = yield* checkEntityPermission({
					entityId: input.botId,
					entityType: "bot",
					permission: "edit",
					userId: context.auth.user.id,
					zedToken: context.meta?.zedToken,
				});

				const canAttach =
					canManageAccess.permissionship ===
						v1.CheckPermissionResponse_Permissionship.HAS_PERMISSION ||
					canEdit.permissionship ===
						v1.CheckPermissionResponse_Permissionship.HAS_PERMISSION;

				if (!canAttach) {
					return yield* Effect.fail(
						errors.FORBIDDEN({
							data: {
								allowed: false,
								permission: "manage_access",
								entityType: "bot",
								zedToken: context.meta?.zedToken,
							},
						}),
					);
				}

				const [courseRow] = yield* db
					.select({ organizationId: dbSchema.course.organizationId })
					.from(dbSchema.course)
					.where(eq(dbSchema.course.id, input.courseId))
					.limit(1);

				const botScopes = yield* db
					.select({ organizationId: dbSchema.resourceScope.organizationId })
					.from(dbSchema.resourceScope)
					.where(
						and(
							eq(dbSchema.resourceScope.resourceType, "bot"),
							eq(dbSchema.resourceScope.resourceId, input.botId),
							isNull(dbSchema.resourceScope.endedAt),
						),
					);

				if (
					courseRow &&
					botScopes.length > 0 &&
					!botScopes.some(
						(scope) => scope.organizationId === courseRow.organizationId,
					)
				) {
					return yield* Effect.fail(
						errors.FORBIDDEN({
							message:
								"Bots can only be attached to courses within the same organization scope",
							data: {
								allowed: false,
								permission: "manage",
								entityType: "course",
							},
						}),
					);
				}

				yield* db
					.insert(dbSchema.courseBot)
					.values({
						courseId: input.courseId,
						botId: input.botId,
						createdAt: new Date(),
						createdBy: context.auth.user.id,
					})
					.onConflictDoNothing();

				yield* authz.applyRelationshipMutations({
					mutations: [
						{
							resourceType: "bot",
							resourceId: input.botId,
							relation: "course",
							subjectType: "course",
							subjectId: input.courseId,
							operation: "touch",
						},
					],
				});

				return {
					success: true,
					message: "Bot attached to course successfully",
				};
			}),
		),
	);

export const detachCourseBot = authed.course.detachBot
	.use(
		checkPermissionMiddleware,
		(input) =>
			({
				entityId: input.courseId,
				permission: "manage",
				entityType: "course",
			}) satisfies CheckPermissionInput,
	)
	.handler(async ({ input }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;
				const authz = yield* AuthzService;

				yield* db
					.delete(dbSchema.courseBot)
					.where(
						and(
							eq(dbSchema.courseBot.courseId, input.courseId),
							eq(dbSchema.courseBot.botId, input.botId),
						),
					);

				yield* authz.applyRelationshipMutations({
					mutations: [
						{
							resourceType: "bot",
							resourceId: input.botId,
							relation: "course",
							subjectType: "course",
							subjectId: input.courseId,
							operation: "delete",
						},
					],
				});

				return {
					success: true,
					message: "Bot detached from course successfully",
				};
			}),
		),
	);
