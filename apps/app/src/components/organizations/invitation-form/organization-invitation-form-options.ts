import type { OrganizationRole } from "@orcai/core";
import { createOrganizationInvitationsInputSchema } from "@orcai/schema";
import { formOptions } from "@tanstack/form-core";
import type { z } from "zod/v4";
import { getLocale } from "@/paraglide/runtime";

const defaultValues = (
	organizationId?: string,
): z.input<typeof createOrganizationInvitationsInputSchema> => ({
	organizationId: organizationId ?? "",
	role: "member" satisfies OrganizationRole,
	expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Default to 7 days from now
	locale: getLocale(),
	items: [
		{
			email: "",
		},
	],
});

export const organizationInvitationFormOptions = (organizationId?: string) =>
	formOptions({
		defaultValues: defaultValues(organizationId),
		validators: {
			onChange: createOrganizationInvitationsInputSchema,
		},
	});
