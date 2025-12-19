import { formOptions } from "@tanstack/react-form";
import type { z } from "zod/v4";
import {
	type OrganizationProvider,
	organizationProviderInsertSchema,
} from "@/lib/orpc/schemas/organization-provider";

const defaultValues = (
	organizationProvider?: OrganizationProvider,
): z.input<typeof organizationProviderInsertSchema> => ({
	providerSlug: organizationProvider?.providerSlug ?? "",
	apiKey: organizationProvider?.apiKeyEncrypted ?? "",
	enabled: organizationProvider?.enabled ?? true,
});

export const organizationProviderFormOptions = (
	organizationProvider?: OrganizationProvider,
) =>
	formOptions({
		defaultValues: defaultValues(organizationProvider),
		validators: {
			onChange: organizationProviderInsertSchema,
		},
	});
