import { userFieldsSchema } from "@orcai/schema";
import { formOptions } from "@tanstack/react-form";

const profileSchema = userFieldsSchema.pick({
	name: true,
});

export const profileFormOptions = (name: string) =>
	formOptions({
		defaultValues: {
			name,
		},
		validators: {
			onChange: profileSchema,
		},
	});
