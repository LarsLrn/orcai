import { resetPasswordSchema } from "@orcai/schema";
import { formOptions } from "@tanstack/form-core";

export const resetPasswordFormOptions = () =>
	formOptions({
		defaultValues: {
			password: "",
			confirmPassword: "",
		},
		validators: {
			onChange: resetPasswordSchema,
		},
	});
