import { emailActionSchema } from "@orcai/schema";
import { formOptions } from "@tanstack/form-core";

export const forgotPasswordFormOptions = () =>
	formOptions({
		defaultValues: {
			email: "",
		},
		validators: {
			onChange: emailActionSchema,
		},
	});
