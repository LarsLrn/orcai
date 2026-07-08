import { createHash } from "node:crypto";
import { expo } from "@better-auth/expo";
import { dbSchema } from "@orcai/db";
import { enqueueNotification } from "@orcai/notifications";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import * as Redacted from "effect/Redacted";
import { v4 as uuidv4 } from "uuid";
import { authDb } from "@/lib/auth/auth-db";
import { runtime } from "@/lib/effect/runtime";
import { loadAppConfigSync } from "@/lib/effect/services/config";

const cfg = loadAppConfigSync();

export const auth = betterAuth({
	baseURL: cfg.auth.url,
	secret: Redacted.value(cfg.auth.secret),
	telemetry: {
		enabled: false,
	},
	trustedOrigins: [
		cfg.auth.url,
		"http://localhost:3000",
	],
	// tanstackStartCookies plugin must be last in the array
	plugins: [
		admin(),
		expo(),
		tanstackStartCookies(),
	],
	database: drizzleAdapter(authDb, {
		provider: "pg",
		schema: {
			user: dbSchema.user,
			account: dbSchema.account,
			session: dbSchema.session,
			verification: dbSchema.verification,
		},
	}),
	emailAndPassword: {
		enabled: true,
		requireEmailVerification: true,
		revokeSessionsOnPasswordReset: true,
		sendResetPassword: async ({ user, url, token }, _request) => {
			await runtime.runPromise(
				enqueueNotification(
					{
						type: "auth.reset-password",
						recipient: user.email,
						recipientName: user.name,
						resetUrl: url,
					},
					`auth.reset-password:${createHash("sha256").update(token).digest("hex")}`,
				),
			);
		},
	},
	emailVerification: {
		sendOnSignUp: true,
		sendOnSignIn: true,
		autoSignInAfterVerification: true,
		sendVerificationEmail: async ({ user, url, token }) => {
			await runtime.runPromise(
				enqueueNotification(
					{
						type: "auth.verify-email",
						recipient: user.email,
						recipientName: user.name,
						verificationUrl: url,
					},
					`auth.verify-email:${createHash("sha256").update(token).digest("hex")}`,
				),
			);
		},
	},
	advanced: {
		database: {
			generateId: () => uuidv4(),
		},
	},
	session: {
		additionalFields: {
			activeOrganizationId: {
				type: "string",
				required: false,
				input: true,
			},
		},
	},
});
