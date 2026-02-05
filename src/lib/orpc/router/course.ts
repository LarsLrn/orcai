import { getLogger } from "@orpc/experimental-pino";
import { count, eq, getColumns, inArray } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { course, courseMember } from "@/db/schema/course";
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
import { createRelation, listAllowedEntities } from "@/lib/spice-db/actions";

export const listCourses = authed.course.list.handler(
	async ({ input, context }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;

				const allowedIds = yield* listAllowedEntities({
					userId: context.auth.user.id,
					action: "read",
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
							.select({ ...getColumns(course) })
							.from(course)
							.where(inArray(course.id, allowedIds))
							.limit(input.pageSize)
							.offset(input.pageIndex * input.pageSize),
						db
							.select({ count: count() })
							.from(course)
							.where(inArray(course.id, allowedIds)),
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
				action: "read",
				entityType: "course",
				zedToken: input.zedToken,
			}) satisfies CheckPermissionInput,
	)
	.handler(async ({ input, errors }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;

				const [query] = yield* db
					.select({ ...getColumns(course) })
					.from(course)
					.where(eq(course.id, input.id));

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
	.use(requireActiveOrganizationMiddleware)
	.handler(async ({ input, context }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;

				const [query] = yield* db
					.insert(course)
					.values({
						title: input.title,
						description: input.description,
						contentJson: input.contentJson,
						contentHtml: input.contentHtml,
						organizationId: context.auth.session.activeOrganizationId,
						config: input.config,
					})
					.returning({ ...getColumns(course) });

				yield* db.insert(courseMember).values({
					courseId: query.id,
					userId: context.auth.user.id,
					role: "instructor", // TODO: Make enum
				});

				const relationResult = yield* createRelation({
					entityId: query.id,
					entityType: "course",
					userId: context.auth.user.id,
					relation: "owner",
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
				action: "update",
				entityType: "course",
			}) satisfies CheckPermissionInput,
	)
	.handler(async ({ input }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;

				const [query] = yield* db
					.update(course)
					.set({
						contentJson: input.contentJson,
						contentHtml: input.contentHtml,
						title: input.title,
						description: input.description,
						config: input.config,
						updatedAt: new Date(),
					})
					.where(eq(course.id, input.id))
					.returning({ ...getColumns(course) });

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
				action: "delete",
				entityType: "course",
			}) satisfies CheckManyPermissionInput,
	)
	.handler(async ({ context }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;
				const logger = getLogger(context);
				logger?.info({ ids: context.allowedIds }, "Deleting courses by IDs");

				// Check if there are any IDs to delete
				if (!context.allowedIds || context.allowedIds.length === 0) {
					return { success: true, message: "No courses to delete" };
				}

				yield* db.delete(course).where(inArray(course.id, context.allowedIds));

				return { success: true, message: "Courses deleted successfully" };
			}),
		),
	);
