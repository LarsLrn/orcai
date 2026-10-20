import {
	checkProviderEndpoint,
	type Provider,
	providerFieldsSchema,
} from "@orcai/schema";
import { formOptions } from "@tanstack/react-form";
import { z } from "zod/v4";

/** The endpoint is edited as text; blank stands for none. */
const providerFormFieldsSchema = providerFieldsSchema.extend({
	endpoint: z.union([
		z.literal(""),
		z.url(),
	]),
});

const providerFormSchema = providerFormFieldsSchema.check(
	checkProviderEndpoint,
);

/** A blank key on edit keeps the stored one. */
const providerEditFormSchema = providerFormFieldsSchema
	.extend({
		apiKey: z.string(),
	})
	.check(checkProviderEndpoint);

const defaultValues = (
	provider?: Provider,
): z.input<typeof providerFormFieldsSchema> => ({
	apiKey: "",
	enabled: provider?.enabled ?? true,
	meteringMode: provider?.meteringMode ?? "requests",
	kind: provider?.kind ?? "openai-compatible",
	endpoint: provider?.endpoint ?? "",
	name: provider?.name ?? "",
	description: provider?.description ?? "",
});

export const providerFormOptions = (provider?: Provider) =>
	formOptions({
		defaultValues: defaultValues(provider),
		validators: {
			onChange: provider ? providerEditFormSchema : providerFormSchema,
		},
	});
