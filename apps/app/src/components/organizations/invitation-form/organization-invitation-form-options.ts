import type { OrganizationRole } from "@orcai/core";
import {
	createOrganizationInvitationsInputSchema,
	DEFAULT_INVITATION_TTL_DAYS,
} from "@orcai/schema";
import { formOptions } from "@tanstack/form-core";
import type { z } from "zod/v4";
import { getLocale } from "@/paraglide/runtime";

const defaultValues = (): z.input<
	typeof createOrganizationInvitationsInputSchema
> => ({
	role: "member" satisfies OrganizationRole,
	expiresAt: new Date(
		Date.now() + DEFAULT_INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000,
	),
	locale: getLocale(),
	items: [
		{
			email: "",
		},
	],
});

export const organizationInvitationFormOptions = () =>
	formOptions({
		defaultValues: defaultValues(),
		validators: {
			onChange: createOrganizationInvitationsInputSchema,
		},
	});
