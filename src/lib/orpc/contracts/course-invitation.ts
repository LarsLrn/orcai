import { createSelectSchema, createUpdateSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { courseInvitation } from "@/db/schema/course-invitation";
import { paginationSchema } from "../schemas/shared";
import { base } from "./base";

export const courseInvitationSelectSchema =
	createSelectSchema(courseInvitation);

export const courseInvitationInsertSchema = z.object({
	courseId: courseInvitationSelectSchema.shape.courseId.nonempty(
		"Please select a course",
	),
	role: courseInvitationSelectSchema.shape.role.nonempty(
		"Please select a course",
	), // TODO: Validate against courseRoles
	expiresAt: courseInvitationSelectSchema.shape.expiresAt, // TODO: Set constraints
	items: z
		.array(
			z.object({
				email: z.email("Field must be a valid email"),
			}),
		)
		.min(1, "Please add at least one email")
		.max(200, "Max 200 emails")
		.check((ctx) => {
			const emails = ctx.value.map((item) => item.email.toLowerCase());
			const uniqueEmails = new Set(emails);

			if (uniqueEmails.size !== emails.length) {
				ctx.issues.push({
					code: "custom",
					message: "Emails must be unique",
					path: ["root"],
					input: "",
				});
			}
		}),
});

export const courseInvitationUpdateSchema = createUpdateSchema(
	courseInvitation,
	{
		id: courseInvitationSelectSchema.shape.id,
		courseId: courseInvitationSelectSchema.shape.courseId,
	},
);

export const courseInvitationDeleteSchema = z.object({
	courseId: courseInvitationSelectSchema.shape.courseId,
	refs: z.array(courseInvitationUpdateSchema.pick({ id: true })),
});

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
	.output(z.object({ success: z.boolean(), message: z.string().optional() }));

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
	.output(z.object({ success: z.boolean(), message: z.string().optional() }));
