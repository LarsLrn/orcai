import { initSchema } from "@orcai/schema";
import { formOptions } from "@tanstack/form-core";

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
