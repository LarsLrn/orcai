import { createOrganizationInputSchema, sharedSchemas } from "@orcai/schema";
import { z } from "zod/v4";

export const bootstrapStatusSchema = z.object({
	initialized: z.boolean(),
});

export const bootstrapInitializeSchema = z.object({
	name: sharedSchemas.name,
	email: sharedSchemas.email,
	password: sharedSchemas.password,
	organizationName: createOrganizationInputSchema.shape.name,
	organizationSlug: createOrganizationInputSchema.shape.slug,
});

export type BootstrapStatus = z.infer<typeof bootstrapStatusSchema>;
export type BootstrapInitialize = z.infer<typeof bootstrapInitializeSchema>;
