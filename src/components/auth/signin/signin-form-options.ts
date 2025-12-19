import { formOptions } from "@tanstack/form-core";
import { signinSchema } from "@/db/zod/signin";

export const signinFormOptions = () =>
	formOptions({
		defaultValues: {
			email: "",
			password: "",
		},
		validators: {
			onChange: signinSchema,
		},
	});
