import { expo } from "@better-auth/expo";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { Effect } from "effect";
import * as Redacted from "effect/Redacted";
import { v4 as uuidv4 } from "uuid";
import { dbSchema } from "@/db/schema";
import { authDb } from "@/lib/auth/auth-db";
import { runtime } from "@/lib/effect/runtime";
import { loadAppConfigSync } from "@/lib/effect/services/config";
import { EmailService } from "@/lib/effect/services/email";

const cfg = loadAppConfigSync();

export const auth = betterAuth({
	baseURL: cfg.auth.url,
	secret: Redacted.value(cfg.auth.secret),
	telemetry: { enabled: false },
	trustedOrigins: [
		cfg.auth.url,
		"http://localhost:3000",
		"http://host.docker.internal:3000",
		"sokratest://",
		"http://10.0.2.2:3000",
	],
	// tanstackStartCookies plugin must be last in the array
	plugins: [admin(), expo(), tanstackStartCookies()],
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
		sendResetPassword: async ({ user, url }, _request) => {
			await runtime.runPromise(
				Effect.gen(function* () {
					const { send } = yield* EmailService;

					yield* send({
						to: user.email,
						subject: "Reset your password",
						text: `Click the link to reset your password: ${url}`,
					});
				}),
			);
		},
	},
	emailVerification: {
		sendVerificationEmail: async ({ user, url }) => {
			await runtime.runPromise(
				Effect.gen(function* () {
					const { send } = yield* EmailService;

					yield* send({
						to: user.email,
						subject: "Verify your email address",
						text: `Click the link to verify your email: ${url}`,
					});
				}),
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
