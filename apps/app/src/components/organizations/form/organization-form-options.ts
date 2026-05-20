import { organizationFieldsSchema } from "@orcai/schema";
import { formOptions } from "@tanstack/react-form";
import type { z } from "better-auth";

const defaultValues = (): z.input<typeof organizationFieldsSchema> => ({
	name: "",
	slug: "",
	logo: null,
	metadata: null,
});

export const organizationFormOptions = formOptions({
	defaultValues: defaultValues(),
	validators: {
		onChange: organizationFieldsSchema,
	},
});
