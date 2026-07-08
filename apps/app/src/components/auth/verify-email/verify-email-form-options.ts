import { emailActionSchema } from "@orcai/schema";
import { formOptions } from "@tanstack/form-core";

export const verifyEmailFormOptions = () =>
	formOptions({
		defaultValues: {
			email: "",
		},
		validators: {
			onChange: emailActionSchema,
		},
	});
