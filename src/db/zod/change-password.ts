import { z } from "zod/v4";
import { sharedSchemas } from "./shared";

export const changePasswordSchema = z
	.object({
		currentPassword: sharedSchemas.password,
		password: sharedSchemas.password,
		confirmPassword: sharedSchemas.password,
	})
	.refine((data) => data.password === data.confirmPassword, {
		message: "Passwords must match",
		path: ["confirmPassword"],
	});
