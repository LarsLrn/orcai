import { z } from "zod/v4";
import { sharedSchemas } from "./shared";

export const initSchema = z
	.object({
		email: sharedSchemas.email,
		name: sharedSchemas.name,
		password: sharedSchemas.password,
		confirmPassword: sharedSchemas.password,
		organizationName: z.string().min(1, "Organization name is required"),
		organizationSlug: z.string().min(1, "Organization slug is required"),
		privacyConsent: z.boolean().refine((val) => val === true, {
			message: "You must accept the privacy policy",
		}),
	})
	.refine((data) => data.password === data.confirmPassword, {
		message: "Passwords must match",
		path: [
			"confirmPassword",
		],
	});

export type InitSchemaType = z.infer<typeof initSchema>;
