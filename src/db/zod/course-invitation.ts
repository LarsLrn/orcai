import {
	createInsertSchema,
	createSelectSchema,
	createUpdateSchema,
} from "drizzle-zod";
import { z } from "zod/v4";
import { courseInvitation } from "@/db/schema/course-invitation";

const insertBaseSchema = createInsertSchema(courseInvitation);

const courseInvitationsInsertSchema = z.object({
	courseId: insertBaseSchema.shape.courseId.nonempty("Please select a course"),
	role: insertBaseSchema.shape.role.nonempty("Please select a course"), // TODO: Validate against courseRoles
	expiresAt: insertBaseSchema.shape.expiresAt, // TODO: Set constraints
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

const courseInvitationUpdateSchema = createUpdateSchema(courseInvitation, {
	id: z.string(),
});

const courseInvitationDeleteSchema = z.object({
	refs: z.array(courseInvitationUpdateSchema.pick({ id: true })),
});

const courseInvitationSelectSchema = createSelectSchema(courseInvitation);

type CourseInvitationsInsertSchemaType = z.infer<
	typeof courseInvitationsInsertSchema
>;
type CourseInvitationUpdateSchemaType = z.infer<
	typeof courseInvitationUpdateSchema
>;
type CourseInvitationDeleteSchemaType = z.infer<
	typeof courseInvitationDeleteSchema
>;
