import { z } from "zod/v4";
import { organizationInvitationSelectSchema } from "@/lib/orpc/schemas/organization-invitation";
import { userInsertSchema } from "@/lib/orpc/schemas/user";
import { sharedSchemas } from "./shared";

export const signupSchema = z
	.object({
		email: userInsertSchema.shape.email,
		name: userInsertSchema.shape.name,
		password: sharedSchemas.password,
		confirmPassword: sharedSchemas.password,
		invitationId: organizationInvitationSelectSchema.shape.id,
		privacyConsent: z.boolean().refine((val) => val === true, {
			message: "You must accept the privacy policy",
		}),
	})
	.refine((data) => data.password === data.confirmPassword, {
		message: "Passwords must match",
		path: ["confirmPassword"],
	});

export type SignupSchemaType = z.infer<typeof signupSchema>;
