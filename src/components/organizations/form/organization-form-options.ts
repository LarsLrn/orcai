import { formOptions } from "@tanstack/react-form";
import { organizationInsertSchema } from "@/lib/orpc/schemas/organization";

export const organizationFormOptions = formOptions({
	defaultValues: {
		name: "",
		slug: "",
	},
	validators: {
		onChange: organizationInsertSchema,
	},
});
