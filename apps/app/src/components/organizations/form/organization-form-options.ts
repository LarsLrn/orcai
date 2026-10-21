import { modelIdSchema, organizationFieldsSchema } from "@orcai/schema";
import { formOptions } from "@tanstack/react-form";
import type { z } from "zod/v4";

const organizationFormSchema = organizationFieldsSchema.extend({
	assistantModelId: modelIdSchema.nullable(),
	utilityModelId: modelIdSchema.nullable(),
});

const defaultValues = (): z.input<typeof organizationFormSchema> => ({
	name: "",
	slug: "",
	logo: null,
	metadata: null,
	assistantModelId: null,
	utilityModelId: null,
});

export const organizationFormOptions = formOptions({
	defaultValues: defaultValues(),
	validators: {
		onChange: organizationFormSchema,
	},
});
