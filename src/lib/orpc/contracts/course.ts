import { z } from "zod/v4";
import { botSelectSchema } from "@/lib/orpc/schemas/bot";
import {
	courseAttachBotSchema,
	courseDeleteSchema,
	courseDetachBotSchema,
	courseInsertSchema,
	courseListBotsSchema,
	courseSelectSchema,
	courseUpdateSchema,
} from "@/lib/orpc/schemas/course";
import {
	paginationSchema,
	statusSchema,
	zedTokenSchema,
} from "@/lib/orpc/schemas/shared";
import { base } from "./base";

export const listCoursesContract = base
	.route({
		method: "GET",
		path: "/courses",
		summary: "List all courses",
		tags: ["Courses"],
	})
	.input(z.object({ ...paginationSchema.shape, ...zedTokenSchema.shape }))
	.output(
		z.object({ data: z.array(courseSelectSchema), rowCount: z.number() }),
	);

export const createCourseContract = base
	.route({
		method: "POST",
		path: "/courses",
		summary: "Create a course",
		tags: ["Courses"],
	})
	.input(courseInsertSchema)
	.output(
		z.object({ data: courseSelectSchema, meta: zedTokenSchema.optional() }),
	);

export const findCourseContract = base
	.route({
		method: "GET",
		path: "/courses/{id}",
		summary: "Find a course",
		tags: ["Courses"],
	})
	.input(z.object({ id: courseSelectSchema.shape.id, ...zedTokenSchema.shape }))
	.output(z.object({ data: courseSelectSchema }));

export const updateCourseContract = base
	.route({
		method: "PUT",
		path: "/courses/{id}",
		summary: "Update a course",
		tags: ["Courses"],
	})
	.errors({
		NOT_FOUND: {
			message: "Course not found",
			data: z.object({ id: courseUpdateSchema.shape.id }),
		},
	})
	.input(courseUpdateSchema)
	.output(z.object({ data: courseSelectSchema }));

export const deleteCourseContract = base
	.route({
		method: "DELETE",
		path: "/courses",
		summary: "Delete a course",
		tags: ["Courses"],
	})
	.input(courseDeleteSchema)
	.output(statusSchema);

export const listCourseBotsContract = base
	.route({
		method: "GET",
		path: "/courses/{courseId}/bots",
		summary: "List bots linked to a course",
		tags: ["Courses"],
	})
	.input(courseListBotsSchema)
	.output(z.object({ data: z.array(botSelectSchema), rowCount: z.number() }));

export const attachCourseBotContract = base
	.route({
		method: "POST",
		path: "/courses/{courseId}/bots/{botId}",
		summary: "Attach a bot to a course",
		tags: ["Courses"],
	})
	.input(courseAttachBotSchema)
	.output(statusSchema);

export const detachCourseBotContract = base
	.route({
		method: "DELETE",
		path: "/courses/{courseId}/bots/{botId}",
		summary: "Detach a bot from a course",
		tags: ["Courses"],
	})
	.input(courseDetachBotSchema)
	.output(statusSchema);
