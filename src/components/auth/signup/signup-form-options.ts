import { formOptions } from "@tanstack/form-core";
import { signupSchema } from "@/db/zod/signup";

export const signupFormOptions = (defaults?: {
	email?: string;
	invitationId?: string;
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
