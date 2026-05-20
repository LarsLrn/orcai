import { z } from "zod/v4";
import { organizationIdSchema } from "./ref";

export const organizationFieldsSchema = z.object({
	name: z.string().min(1, "Name is required"),
	slug: z.string().min(1, "Slug is required"),
	logo: z.string().nullable().optional(),
	metadata: z.string().nullable().optional(),
});

export const organizationMutableFieldsSchema =
	organizationFieldsSchema.partial();

export const organizationSchema = organizationFieldsSchema.extend({
	id: organizationIdSchema,
	createdAt: z.coerce.date(),
});

export type Organization = z.infer<typeof organizationSchema>;
