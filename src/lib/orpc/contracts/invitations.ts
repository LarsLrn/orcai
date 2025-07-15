import { createSelectSchema, createUpdateSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { courseInvitation } from "@/db/schema/course-invitation";
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
		id: z.uuidv4(),
	},
);

export const courseInvitationDeleteSchema = z.object({
	refs: z.array(courseInvitationUpdateSchema.pick({ id: true })),
});

export const listInvitationsContract = base
	.route({
		method: "GET",
		path: "/invitations",
		summary: "List all invitations",
		tags: ["Invitations"],
	})
	.input(
		z.object({
			pageSize: z.number().int().min(1).max(100).default(10),
			pageIndex: z.number().int().min(0).default(0),
		}),
	)
	.output(
		z.object({
			data: z.array(courseInvitationSelectSchema),
			rowCount: z.number(),
		}),
	);

export const createInvitationsContract = base
	.route({
		method: "POST",
		path: "/invitations",
		summary: "Create many invitations",
		tags: ["Invitations"],
	})
	.input(courseInvitationInsertSchema)
	.output(z.object({ data: z.array(courseInvitationSelectSchema) }));

export const findInvitationContract = base
	.route({
		method: "GET",
		path: "/invitations/{id}",
		summary: "Find an invitation",
		tags: ["Invitations"],
	})
	.input(courseInvitationSelectSchema.pick({ id: true }))
	.output(z.object({ data: courseInvitationSelectSchema }));

export const updateInvitationContract = base
	.route({
		method: "PUT",
		path: "/invitations/{id}",
		summary: "Update an invitation",
		tags: ["Invitations"],
	})
	.errors({
		NOT_FOUND: {
			message: "Invitation not found",
			data: z.object({ id: courseInvitationUpdateSchema.shape.id }),
		},
	})
	.input(courseInvitationUpdateSchema)
	.output(z.object({ data: courseInvitationSelectSchema }));

export const deleteInvitationContract = base
	.route({
		method: "DELETE",
		path: "/invitations/",
		summary: "Delete an invitation",
		tags: ["Invitations"],
	})
	.input(courseInvitationDeleteSchema)
	.output(z.object({ success: z.boolean(), message: z.string().optional() }));

export const respondToInvitationContract = base
	.route({
		method: "POST",
		path: "/invitations/{id}/respond",
		summary: "Respond to an invitation",
		tags: ["Invitations"],
	})
	.input(
		z.object({
			id: courseInvitationSelectSchema.shape.id,
			response: z.enum(["accept", "reject"]),
		}),
	)
	.output(z.object({ success: z.boolean(), message: z.string().optional() }));
