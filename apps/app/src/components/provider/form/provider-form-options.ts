import { type Provider, providerFieldsSchema } from "@orcai/schema";
import { formOptions } from "@tanstack/react-form";
import type { z } from "zod/v4";

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
			onChange: providerFieldsSchema,
		},
	});
