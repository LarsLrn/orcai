import { createInsertSchema, createUpdateSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organization } from "@/db/schema/auth";

export const organizationInsertSchema = createInsertSchema(organization, {
	createdAt: (schema) => schema.optional(),
});

export const organizationUpdateSchema = createUpdateSchema(organization);

export const organizationDeleteSchema = z.object({
	refs: z.array(organizationUpdateSchema.pick({ id: true })),
});

export type OrganizationInsertSchemaType = z.infer<
	typeof organizationInsertSchema
>;
export type OrganizationUpdateSchemaType = z.infer<
	typeof organizationUpdateSchema
>;
export type OrganizationDeleteSchemaType = z.infer<
	typeof organizationDeleteSchema
>;
