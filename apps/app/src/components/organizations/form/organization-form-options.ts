import { modelIdSchema, organizationFieldsSchema } from "@orcai/schema";
import { formOptions } from "@tanstack/react-form";
import type { z } from "zod/v4";

const organizationFormSchema = organizationFieldsSchema.extend({
	assistantModelId: modelIdSchema.nullable(),
});

const defaultValues = (): z.input<typeof organizationFormSchema> => ({
	name: "",
	slug: "",
	logo: null,
	metadata: null,
	assistantModelId: null,
});

export const organizationFormOptions = formOptions({
	defaultValues: defaultValues(),
	validators: {
		onChange: organizationFormSchema,
	},
});
