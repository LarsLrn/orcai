import { createOrganizationInvitationsInputSchema } from "@orcai/schema";
import { formOptions } from "@tanstack/form-core";

const defaultValues = (organizationId?: string) => ({
	organizationId: organizationId ?? "",
	role: "student",
	expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Default to 7 days from now
	items: [
		{
			email: "",
		},
	],
});

export const organizationInvitationFormOptions = (organizationId?: string) =>
	formOptions({
		defaultValues: defaultValues(organizationId),
		validators: {
			onChange: createOrganizationInvitationsInputSchema,
		},
	});
