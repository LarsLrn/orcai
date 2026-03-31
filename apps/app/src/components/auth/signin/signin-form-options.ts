import { signinSchema } from "@orcai/schema";
import { formOptions } from "@tanstack/form-core";

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
