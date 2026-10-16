import { type Provider, providerFieldsSchema } from "@orcai/schema";
import { formOptions } from "@tanstack/react-form";
import { z } from "zod/v4";

/** A blank key on edit keeps the stored one. */
const providerEditFormSchema = providerFieldsSchema.extend({
	apiKey: z.string(),
});

const defaultValues = (
	provider?: Provider,
): z.input<typeof providerFieldsSchema> => ({
	apiKey: "",
	enabled: provider?.enabled ?? true,
	meteringMode: provider?.meteringMode ?? "requests",
	compatibility: provider?.compatibility ?? "openai",
	endpoint: provider?.endpoint ?? "",
	name: provider?.name ?? "",
	description: provider?.description ?? "",
});

export const providerFormOptions = (provider?: Provider) =>
	formOptions({
		defaultValues: defaultValues(provider),
		validators: {
			onChange: provider ? providerEditFormSchema : providerFieldsSchema,
		},
	});
