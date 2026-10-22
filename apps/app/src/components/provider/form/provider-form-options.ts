import {
	checkProviderFields,
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

const providerFormSchema = providerFormFieldsSchema.check(checkProviderFields);

/** A blank key on edit keeps the stored one. */
const providerEditFormSchema = providerFormFieldsSchema
	.extend({
		apiKey: z.string(),
	})
	.check(checkProviderFields);

const defaultValues = (
	provider?: Provider,
): z.input<typeof providerFormFieldsSchema> => ({
	apiKey: "",
	enabled: provider?.enabled ?? true,
	meteringMode: provider?.meteringMode ?? "requests",
	currency: provider?.currency ?? "USD",
	reportsCost: provider?.reportsCost ?? false,
	searchPrice: provider?.searchPrice ?? null,
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
