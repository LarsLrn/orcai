import { z } from "zod/v4";
import { sharedSchemas } from "./shared";

export const loginSchema = z.object({
	email: sharedSchemas.email,
	password: sharedSchemas.password,
});

export type LoginSchemaType = z.infer<typeof loginSchema>;
