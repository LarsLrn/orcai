import { formOptions } from "@tanstack/form-core";
import { initSchema } from "@/db/zod/init";

export const initFormOptions = () =>
	formOptions({
		defaultValues: {
			email: "",
			name: "",
			password: "",
			confirmPassword: "",
			organizationName: "",
			organizationSlug: "",
			privacyConsent: false,
		},
		validators: {
			onChange: initSchema,
		},
	});
