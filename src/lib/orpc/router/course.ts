import { count, eq, getColumns, inArray } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { dbSchema } from "@/db/schema";
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
	.use(requireActiveOrganizationMiddleware)
	.handler(async ({ input, context }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;

				const [query] = yield* db
					.insert(dbSchema.course)
					.values({
						title: input.title,
						description: input.description,
						contentJson: input.contentJson,
						contentHtml: input.contentHtml,
						organizationId: context.auth.session.activeOrganizationId,
						config: input.config,
					})
					.returning({ ...getColumns(dbSchema.course) });

				yield* db.insert(dbSchema.courseMember).values({
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
				action: "delete",
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
