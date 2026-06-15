import { z } from "zod/v4";
import { createOrganizationInputSchema } from "../organization/inputs";
import { sharedSchemas } from "../shared/forms/shared";

export const bootstrapStatusInputSchema = z.object({});

export const bootstrapInitializeInputSchema = z.object({
	name: sharedSchemas.name,
	email: sharedSchemas.email,
	password: sharedSchemas.password,
	organizationName: createOrganizationInputSchema.shape.name,
	organizationSlug: createOrganizationInputSchema.shape.slug,
});

export type BootstrapStatusInput = z.infer<typeof bootstrapStatusInputSchema>;
export type BootstrapInitializeInput = z.infer<
	typeof bootstrapInitializeInputSchema
>;
