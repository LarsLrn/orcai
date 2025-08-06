import { z } from "zod/v4";
import {
	courseInvitationDeleteSchema,
	courseInvitationInsertSchema,
	courseInvitationSelectSchema,
	courseInvitationUpdateSchema,
} from "@/lib/orpc/schemas/course-invitations";
import { paginationSchema, statusSchema } from "@/lib/orpc/schemas/shared";
import { base } from "./base";

// TODO: Refactor. There should be endpoints for a) getting all invitations within a course, b) getting all invitations for a user
export const listCourseInvitationsContract = base
	.route({
		method: "GET",
		path: "/courses/invitations",
		summary: "List all course invitations",
		tags: ["Course Invitations"],
	})
	.input(paginationSchema)
	.output(
		z.object({
			data: z.array(courseInvitationSelectSchema),
			rowCount: z.number(),
		}),
	);

export const createCourseInvitationsContract = base
	.route({
		method: "POST",
		path: "/courses/{courseId}/invitations",
		summary: "Create many course invitations",
		tags: ["Course Invitations"],
	})
	.input(courseInvitationInsertSchema)
	.output(z.object({ data: z.array(courseInvitationSelectSchema) }));

export const findCourseInvitationContract = base
	.route({
		method: "GET",
		path: "/courses/{courseId}/invitations/{id}",
		summary: "Find a course invitation",
		tags: ["Course Invitations"],
	})
	.input(courseInvitationSelectSchema.pick({ id: true, courseId: true }))
	.output(z.object({ data: courseInvitationSelectSchema }));

export const updateCourseInvitationContract = base
	.route({
		method: "PUT",
		path: "/courses/{courseId}/invitations/{id}",
		summary: "Update a course invitation",
		tags: ["Course Invitations"],
	})
	.errors({
		NOT_FOUND: {
			message: "Course invitation not found",
			data: z.object({ id: courseInvitationUpdateSchema.shape.id }),
		},
	})
	.input(courseInvitationUpdateSchema)
	.output(z.object({ data: courseInvitationSelectSchema }));

export const deleteCourseInvitationsContract = base
	.route({
		method: "DELETE",
		path: "/courses/{courseId}/invitations",
		summary: "Delete a course invitations",
		tags: ["Course Invitations"],
	})
	.input(courseInvitationDeleteSchema)
	.output(statusSchema);

export const respondToCourseInvitationContract = base
	.route({
		method: "POST",
		path: "/courses/{courseId}/invitations/{id}/respond",
		summary: "Respond to a course invitation",
		tags: ["Course Invitations"],
	})
	.input(
		z.object({
			id: courseInvitationSelectSchema.shape.id,
			courseId: courseInvitationSelectSchema.shape.courseId,
			response: z.enum(["accept", "reject"]),
		}),
	)
	.output(statusSchema);
