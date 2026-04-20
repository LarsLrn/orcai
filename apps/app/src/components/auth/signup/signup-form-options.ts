import type { OrganizationInvitationId } from "@orcai/core";
import { signupSchema } from "@orcai/schema";
import { formOptions } from "@tanstack/form-core";

export const signupFormOptions = (defaults?: {
	email?: string;
	invitationId?: OrganizationInvitationId;
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
