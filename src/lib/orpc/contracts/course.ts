import {
	createInsertSchema,
	createSelectSchema,
	createUpdateSchema,
} from "drizzle-zod";
import { z } from "zod/v4";
import { course } from "@/db/schema/course";
import { base } from "./base";

export const courseSelectSchema = createSelectSchema(course);

export const courseInsertSchema = createInsertSchema(course, {
	organizationId: (schema) => schema.optional(),
	description: (schema) =>
		schema.min(20, {
			message: "Description must be at least 20 characters long",
		}),
	// TODO: Coerce received string for maxReferences
	config: (schema) => schema.optional(),
});

export const courseUpdateSchema = createUpdateSchema(course, {
	id: z.uuidv4(),
});

export const courseDeleteSchema = z.object({
	refs: z.array(courseUpdateSchema.pick({ id: true })),
});

export const listCoursesContract = base
	.route({
		method: "GET",
		path: "/courses",
		summary: "List all courses",
		tags: ["Courses"],
	})
	.input(
		z.object({
			pageSize: z.number().int().min(1).max(100).default(10),
			pageIndex: z.number().int().min(0).default(0),
		}),
	)
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
	.output(z.object({ data: courseSelectSchema }));

export const findCourseContract = base
	.route({
		method: "GET",
		path: "/courses/{id}",
		summary: "Find a course",
		tags: ["Courses"],
	})
	.input(courseSelectSchema.pick({ id: true }))
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
	.output(z.object({ success: z.boolean(), message: z.string().optional() }));
