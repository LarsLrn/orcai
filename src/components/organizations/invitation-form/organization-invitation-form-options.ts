import { formOptions } from "@tanstack/form-core";
import { organizationInvitationInsertSchema } from "@/lib/orpc/schemas/organization-invitation";

const defaultValues = () => ({
	organizationId: "",
	role: "student",
	expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Default to 7 days from now
	items: [{ email: "" }],
});

export const organizationInvitationFormOptions = () =>
	formOptions({
		defaultValues: defaultValues(),
		validators: {
			onChange: organizationInvitationInsertSchema,
		},
	});
