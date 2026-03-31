import { z } from "zod/v4";
import { sharedSchemas } from "./shared";

export const signupSchema = z
	.object({
		email: z.email("Invalid email address").min(1, "Email is required"),
		name: z.string().min(1, "Name is required"),
		password: sharedSchemas.password,
		confirmPassword: sharedSchemas.password,
		invitationId: z.uuidv4(),
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

export type SignupSchemaType = z.infer<typeof signupSchema>;
