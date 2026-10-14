import { z } from "zod/v4";
import type { ErrorReason } from "../error-reason";
import { sharedSchemas } from "./shared";

export const signupSchema = z
	.object({
		email: z.email().min(1),
		name: z.string().min(1),
		password: sharedSchemas.password,
		confirmPassword: sharedSchemas.password,
		invitationId: z.uuidv4(),
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

export type SignupSchemaType = z.infer<typeof signupSchema>;
