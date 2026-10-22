import { z } from "zod/v4";

/** The current password, which Better Auth asks for before a 2FA change. */
export const twoFactorPasswordSchema = z.object({
	password: z.string().min(1),
});

export type TwoFactorPasswordSchemaType = z.infer<
	typeof twoFactorPasswordSchema
>;

/** A six-digit code from an authenticator app. */
export const totpCodeSchema = z.object({
	code: z.string().regex(/^\d{6}$/),
});

export type TotpCodeSchemaType = z.infer<typeof totpCodeSchema>;

/** The second sign-in step: an authenticator or backup code. */
export const twoFactorChallengeSchema = z.object({
	code: z.string().trim().min(1),
	trustDevice: z.boolean(),
});

export type TwoFactorChallengeSchemaType = z.infer<
	typeof twoFactorChallengeSchema
>;
