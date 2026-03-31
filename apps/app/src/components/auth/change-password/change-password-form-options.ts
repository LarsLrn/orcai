import { changePasswordSchema } from "@orcai/schema";
import { formOptions } from "@tanstack/form-core";

export const changePasswordFormOptions = () =>
	formOptions({
		defaultValues: {
			currentPassword: "",
			password: "",
			confirmPassword: "",
		},
		validators: {
			onChange: changePasswordSchema,
		},
	});
