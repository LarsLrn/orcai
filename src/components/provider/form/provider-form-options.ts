import { formOptions } from "@tanstack/react-form";
import type { z } from "zod/v4";
import {
	type Provider,
	providerInsertSchema,
} from "@/lib/orpc/schemas/provider";

const defaultValues = (
	provider?: Provider,
): z.input<typeof providerInsertSchema> => ({
	apiKey: provider?.apiKeyEncrypted ?? "",
	enabled: provider?.enabled ?? true,
	compatibility: provider?.compatibility ?? "openai",
	endpoint: provider?.endpoint ?? "",
	name: provider?.name ?? "",
	description: provider?.description ?? "",
});

export const providerFormOptions = (provider?: Provider) =>
	formOptions({
		defaultValues: defaultValues(provider),
		validators: {
			onChange: providerInsertSchema,
		},
	});
