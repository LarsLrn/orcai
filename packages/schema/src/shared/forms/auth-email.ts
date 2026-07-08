import { z } from "zod/v4";
import { sharedSchemas } from "./shared";

export const emailActionSchema = z.object({
	email: sharedSchemas.email,
});

export const resetPasswordSchema = z
	.object({
		password: sharedSchemas.password,
		confirmPassword: sharedSchemas.password,
	})
	.refine((value) => value.password === value.confirmPassword, {
		message: "Passwords must match",
		path: [
			"confirmPassword",
		],
	});

export type EmailActionSchemaType = z.infer<typeof emailActionSchema>;
export type ResetPasswordSchemaType = z.infer<typeof resetPasswordSchema>;
