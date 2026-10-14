import { z } from "zod/v4";
import type { ErrorReason } from "../error-reason";
import { sharedSchemas } from "./shared";

export const changePasswordSchema = z
	.object({
		currentPassword: sharedSchemas.password,
		password: sharedSchemas.password,
		confirmPassword: sharedSchemas.password,
	})
	.refine((data) => data.password === data.confirmPassword, {
		params: {
			reason: "PASSWORDS_MISMATCH" satisfies ErrorReason,
		},
		path: [
			"confirmPassword",
		],
	});
