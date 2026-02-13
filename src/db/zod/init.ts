import { z } from "zod/v4";
import { organizationInsertSchema } from "@/lib/orpc/schemas/organization";
import { sharedSchemas } from "./shared";

export const initSchema = z
	.object({
		email: sharedSchemas.email,
		name: sharedSchemas.name,
		password: sharedSchemas.password,
		confirmPassword: sharedSchemas.password,
		organizationName: organizationInsertSchema.shape.name,
		organizationSlug: organizationInsertSchema.shape.slug,
		privacyConsent: z.boolean().refine((val) => val === true, {
			message: "You must accept the privacy policy",
		}),
	})
	.refine((data) => data.password === data.confirmPassword, {
		message: "Passwords must match",
		path: ["confirmPassword"],
	});

export type InitSchemaType = z.infer<typeof initSchema>;
