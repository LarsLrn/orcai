import { z } from "zod/v4";
import { sharedSchemas } from "./shared";

export const signinSchema = z.object({
	email: sharedSchemas.email,
	password: sharedSchemas.password,
});

export type SigninSchemaType = z.infer<typeof signinSchema>;
