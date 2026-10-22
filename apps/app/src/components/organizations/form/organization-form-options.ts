import { modelIdSchema, organizationFieldsSchema } from "@orcai/schema";
import { formOptions } from "@tanstack/react-form";
import { z } from "zod/v4";

const organizationFormSchema = organizationFieldsSchema.extend({
	assistantModelId: modelIdSchema.nullable(),
	utilityModelId: modelIdSchema.nullable(),
	/** `off`, `native`, or the id of the search provider. */
	webSearch: z.string(),
});

const defaultValues = (): z.input<typeof organizationFormSchema> => ({
	name: "",
	slug: "",
	logo: null,
	metadata: null,
	assistantModelId: null,
	utilityModelId: null,
	webSearch: "off",
});

export const organizationFormOptions = formOptions({
	defaultValues: defaultValues(),
	validators: {
		onChange: organizationFormSchema,
	},
});
