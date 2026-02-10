import { createSelectSchema, createUpdateSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { dbSchema } from "@/db/schema";

/**
 * ----------------
 * Select Schema
 * ----------------
 */

export const courseInvitationSelectSchema = createSelectSchema(
	dbSchema.courseInvitation,
);

/**
 * ----------------
 * Insert Schema
 * ----------------
 */

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

/**
 * ----------------
 * Update Schema
 * ----------------
 */

export const courseInvitationUpdateSchema = createUpdateSchema(
	dbSchema.courseInvitation,
	{
		id: courseInvitationSelectSchema.shape.id,
		courseId: courseInvitationSelectSchema.shape.courseId,
	},
);

/**
 * ----------------
 * Delete Schema
 * ----------------
 */

export const courseInvitationDeleteSchema = z.object({
	courseId: courseInvitationSelectSchema.shape.courseId,
	refs: z.array(courseInvitationUpdateSchema.pick({ id: true })),
});

/**
 * ----------------
 * Type Definitions
 * ----------------
 */

export type CourseInvitation = z.infer<typeof courseInvitationSelectSchema>;
export type CourseInvitationInsert = z.infer<
	typeof courseInvitationInsertSchema
>;
export type CourseInvitationUpdate = z.infer<
	typeof courseInvitationUpdateSchema
>;
export type CourseInvitationDelete = z.infer<
	typeof courseInvitationDeleteSchema
>;
