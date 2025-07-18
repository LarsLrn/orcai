import { ORPCError } from "@orpc/server";
import { count, eq, getTableColumns, inArray } from "drizzle-orm";
import { db } from "@/db/drizzle";
import { course, courseMember } from "@/db/schema/course";
import { authed } from "@/lib/orpc";
import { requireActiveOrganizationMiddleware } from "@/lib/orpc/middlewares/auth";
import {
	checkManyPermissionMiddleware,
	checkPermissionMiddleware,
} from "@/lib/orpc/middlewares/permission";
import { retry } from "@/lib/orpc/middlewares/retry";
import { createRelation, listAllowedEntities } from "@/lib/spice-db/actions";

export const listCourses = authed.course.list
	.use(retry({ times: 3 }))
	.handler(async ({ input, context }) => {
		const { entityIds } = await listAllowedEntities({
			entityType: "course",
			action: "read",
			userId: context.auth.user.id,
		});

		const query = await db
			.select({ ...getTableColumns(course) })
			.from(course)
			.where(inArray(course.id, entityIds))
			.limit(input.pageSize)
			.offset(input.pageIndex * input.pageSize);

		const [rowCount] = await db.select({ count: count() }).from(course);

		return { data: query, rowCount: rowCount.count };
	});

export const findCourse = authed.course.find
	.use(
		checkPermissionMiddleware,
		(input) =>
			({
				entityId: input.id,
				action: "read",
				entityType: "course",
			}) as const,
	)
	.use(retry({ times: 3 }))
	.handler(async ({ input }) => {
		const [query] = await db
			.select({ ...getTableColumns(course) })
			.from(course)
			.where(eq(course.id, input.id));

		if (!query) {
			throw new ORPCError("NOT_FOUND", { message: "Course not found" });
		}

		return { data: query };
	});

export const createCourse = authed.course.create
	.use(requireActiveOrganizationMiddleware)
	.handler(async ({ input, context }) => {
		const [query] = await db
			.insert(course)
			.values({
				title: input.title,
				description: input.description,
				contentJson: input.contentJson,
				contentHtml: input.contentHtml,
				organizationId: context.activeOrganizationId,
				config: input.config,
			})
			.returning({ ...getTableColumns(course) });

		await db.insert(courseMember).values({
			courseId: query.id,
			userId: context.auth.user.id,
			role: "instructor", // TODO: Make enum
		});

		await createRelation({
			entityId: query.id,
			entityType: "course",
			userId: context.auth.user.id,
			relation: "owner",
		});

		return { data: query };
	});

export const updateCourse = authed.course.update
	.use(
		checkPermissionMiddleware,
		(input) =>
			({
				entityId: input.id,
				action: "read",
				entityType: "course",
			}) as const,
	)
	.handler(async ({ input }) => {
		const [query] = await db
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
			.returning({ ...getTableColumns(course) });

		return { data: query };
	});

export const deleteCourses = authed.course.delete
	.use(
		checkManyPermissionMiddleware,
		(input) =>
			({
				entityIds: input.refs.map((ref) => ref.id),
				action: "delete",
				entityType: "course",
			}) as const,
	)
	.handler(async ({ context }) => {
		console.log("Deleting courses with allowed IDs:", context.allowedIds);

		// Check if there are any IDs to delete
		if (!context.allowedIds || context.allowedIds.length === 0) {
			return { success: true, message: "No courses to delete" };
		}

		try {
			await db.delete(course).where(inArray(course.id, context.allowedIds));

			return { success: true, message: "Courses deleted successfully" };
		} catch (error) {
			console.error("Error deleting courses:", error);
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to delete courses",
			});
		}
	});
