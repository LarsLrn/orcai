import { createHash } from "node:crypto";
import { expo } from "@better-auth/expo";
import {
	INSTANCE_ADMIN_ROLE,
	INSTANCE_DEFAULT_ROLE,
	INSTANCE_ROLES,
} from "@orcai/core";
import { dbSchema } from "@orcai/db";
import { enqueueNotification } from "@orcai/notifications";
import { organizationInvitationIdSchema, userIdSchema } from "@orcai/schema";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { admin } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import * as Redacted from "effect/Redacted";
import { v4 as uuidv4 } from "uuid";
import { authDb } from "@/lib/auth/auth-db";
import {
	acceptInvitation,
	activateSoleOrganizationForSessions,
	pendingInvitationsFor,
	soleOrganizationOf,
} from "@/lib/auth/invitation-signup";
import { runtime } from "@/lib/effect/runtime";
import { loadAppConfigSync } from "@/lib/effect/services/config";

const cfg = loadAppConfigSync();

const validateInstanceRole = (role: unknown) => {
	if (!INSTANCE_ROLES.some((value) => value === role))
		throw new APIError("BAD_REQUEST", {
			message: `Instance role must be ${INSTANCE_ROLES.join(" or ")}`,
		});
};

export const auth = betterAuth({
	baseURL: cfg.auth.url,
	secret: Redacted.value(cfg.auth.secret),
	telemetry: {
		enabled: false,
	},
	// The app's own account deletion runs the last-admin guard, the permission
	// outbox and the session cleanup.
	disabledPaths: [
		"/admin/remove-user",
	],
	trustedOrigins: [
		cfg.auth.url,
		"http://localhost:3000",
	],
	// tanstackStartCookies plugin must be last in the array
	plugins: [
		admin({
			adminRoles: [
				INSTANCE_ADMIN_ROLE,
			],
			defaultRole: INSTANCE_DEFAULT_ROLE,
		}),
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
		requireEmailVerification: false,
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
		sendOnSignIn: false,
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
	databaseHooks: {
		user: {
			update: {
				before: (user) => {
					if ("role" in user) validateInstanceRole(user.role);
					return Promise.resolve();
				},
			},
			create: {
				// Registration is by invitation. The bootstrap flow inserts its
				// user with Drizzle rather than through Better Auth, so the first
				// account of an instance does not pass through here and needs no
				// exception.
				before: async (user, ctx) => {
					validateInstanceRole("role" in user ? user.role : "user");
					const invitationId = organizationInvitationIdSchema.safeParse(
						ctx?.body?.invitationId,
					);
					const invitations = await runtime.runPromise(
						pendingInvitationsFor(user.email),
					);

					if (
						!invitationId.success ||
						!invitations.some(
							(invitation) => invitation.id === invitationId.data,
						)
					) {
						throw new APIError("FORBIDDEN", {
							code: "INVITATION_REQUIRED",
							message:
								"Registration is by invitation. Ask an organisation administrator to invite this address.",
						});
					}
				},
				after: async (user, ctx) => {
					const userId = userIdSchema.parse(user.id);

					await runtime.runPromise(
						acceptInvitation({
							invitationId: organizationInvitationIdSchema.parse(
								ctx?.body?.invitationId,
							),
							userId,
							email: user.email,
						}),
					);
					await runtime.runPromise(activateSoleOrganizationForSessions(userId));
				},
			},
		},
		session: {
			create: {
				/** Default a session to its sole organisation.
				 * The picker still handles pending invitations. */
				before: async (session) => {
					if (session.activeOrganizationId) {
						return;
					}

					const organizationId = await runtime.runPromise(
						soleOrganizationOf(userIdSchema.parse(session.userId)),
					);

					if (!organizationId) {
						return;
					}

					return {
						data: {
							...session,
							activeOrganizationId: organizationId,
						},
					};
				},
			},
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
