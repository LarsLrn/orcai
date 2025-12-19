import { formOptions } from "@tanstack/form-core";
import { courseInvitationInsertSchema } from "@/lib/orpc/schemas/course-invitations";

const defaultValues = () => ({
	courseId: "",
	role: "student",
	expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Default to 7 days from now
	items: [{ email: "" }],
});

export const courseInvitationFormOptions = () =>
	formOptions({
		defaultValues: defaultValues(),
		validators: {
			onChange: courseInvitationInsertSchema,
		},
	});
