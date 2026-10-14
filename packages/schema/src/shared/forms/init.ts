import { z } from "zod/v4";
import type { ErrorReason } from "../error-reason";
import { sharedSchemas } from "./shared";

export const initSchema = z
	.object({
		email: sharedSchemas.email,
		name: sharedSchemas.name,
		password: sharedSchemas.password,
		confirmPassword: sharedSchemas.password,
		organizationName: z.string().min(1),
		organizationSlug: z.string().min(1),
		privacyConsent: z.boolean().refine((val) => val === true, {
			params: {
				reason: "PRIVACY_CONSENT_REQUIRED" satisfies ErrorReason,
			},
		}),
	})
	.refine((data) => data.password === data.confirmPassword, {
		params: {
			reason: "PASSWORDS_MISMATCH" satisfies ErrorReason,
		},
		path: [
			"confirmPassword",
		],
	});

export type InitSchemaType = z.infer<typeof initSchema>;
