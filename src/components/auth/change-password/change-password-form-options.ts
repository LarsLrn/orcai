import { formOptions } from "@tanstack/form-core";
import { changePasswordSchema } from "@/db/zod/change-password";

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
