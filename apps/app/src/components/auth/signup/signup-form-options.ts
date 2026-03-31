import { signupSchema } from "@orcai/schema";
import { formOptions } from "@tanstack/form-core";
import type { OrganizationInvitation } from "@/lib/orpc/schemas/organization-invitation";

export const signupFormOptions = (defaults?: {
	email?: string;
	invitationId?: OrganizationInvitation["id"];
}) =>
	formOptions({
		defaultValues: {
			email: defaults?.email ?? "",
			name: "",
			password: "",
			confirmPassword: "",
			invitationId: defaults?.invitationId ?? "",
			privacyConsent: false,
		},
		validators: {
			onChange: signupSchema,
		},
	});
