import { createHash } from "node:crypto";
import {
	INSTANCE_ADMIN_ROLE,
	INSTANCE_DEFAULT_ROLE,
	INSTANCE_ROLES,
} from "@orcai/core";
import { dbSchema } from "@orcai/db";
import { enqueueNotification } from "@orcai/notifications";
import {
	LOCALES,
	localeSchema,
	organizationInvitationIdSchema,
	userIdSchema,
} from "@orcai/schema";
import { betterAuth, type User } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { admin } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import { v4 as uuidv4 } from "uuid";
import { authDb } from "@/lib/auth/auth-db";
import {
	activateSoleOrganizationForSessions,
	pendingInvitationsFor,
	soleOrganizationOf,
} from "@/lib/auth/invitation-signup";
import { acceptInvitation } from "@/lib/authz/organization-membership";
import { secureCookiesFor, zedTokenCookieOptions } from "@/lib/authz/zed-token";
import { runPromise } from "@/lib/effect/runtime";
import { loadAppConfigSync } from "@/lib/effect/services/config";
import { cookieMaxAge, cookieName, getLocale } from "@/paraglide/runtime";
import { COOKIES } from "@/settings/constants";

const cfg = loadAppConfigSync();

/** The user's stored locale, else the request's. */
const emailLocaleOf = (
	user: User & {
		locale?: string | null;
	},
) => localeSchema.catch(getLocale()).parse(user.locale);

const validateInstanceRole = (role: unknown) => {
	if (!INSTANCE_ROLES.some((value) => value === role))
		throw new APIError("BAD_REQUEST", {
			code: "INSTANCE_ROLE_INVALID",
			message: `Instance role must be ${INSTANCE_ROLES.join(" or ")}`,
		});
};

export const auth = betterAuth({
	baseURL: cfg.auth.url,
	secret: Redacted.value(cfg.auth.secret),
	telemetry: {
		enabled: false,
	},
	// The admin plugin only supplies the role and ban fields. Its endpoints
	// stay server-side: the app's procedures guard the last organization admin
	// and run the permission outbox, and impersonation or a set password would
	// bypass the second factor.
	disabledPaths: [
		"/admin/ban-user",
		"/admin/create-user",
		"/admin/get-user",
		"/admin/has-permission",
		"/admin/impersonate-user",
		"/admin/list-user-sessions",
		"/admin/list-users",
		"/admin/remove-user",
		"/admin/revoke-user-session",
		"/admin/revoke-user-sessions",
		"/admin/set-role",
		"/admin/set-user-password",
		"/admin/stop-impersonating",
		"/admin/unban-user",
		"/admin/update-user",
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
			const locale = emailLocaleOf(user);
			await runPromise(
				enqueueNotification(
					{
						type: "auth.reset-password",
						recipient: user.email,
						recipientName: user.name,
						resetUrl: url,
						locale,
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
			const locale = emailLocaleOf(user);
			await runPromise(
				enqueueNotification(
					{
						type: "auth.verify-email",
						recipient: user.email,
						recipientName: user.name,
						verificationUrl: url,
						locale,
					},
					`auth.verify-email:${createHash("sha256").update(token).digest("hex")}`,
				),
			);
		},
	},
	rateLimit: {
		enabled: Option.getOrUndefined(cfg.auth.rateLimit),
	},
	advanced: {
		database: {
			generateId: () => uuidv4(),
		},
	},
	hooks: {
		/** A new browser follows the stored locale; users without one keep the
		 * request's. */
		after: createAuthMiddleware(async (ctx) => {
			const user = ctx.context.newSession?.user;
			if (!ctx.path.startsWith("/sign-in") || !user) return;

			const stored = localeSchema.safeParse(
				"locale" in user ? user.locale : undefined,
			);
			if (stored.success) {
				ctx.setCookie(cookieName, stored.data, {
					path: "/",
					maxAge: cookieMaxAge,
				});
				return;
			}

			await ctx.context.internalAdapter.updateUser(user.id, {
				locale: getLocale(),
			});
		}),
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
					const requestLocale = getLocale();
					validateInstanceRole("role" in user ? user.role : "user");
					const invitationId = organizationInvitationIdSchema.safeParse(
						ctx?.body?.invitationId,
					);
					const invitations = await runPromise(
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

					return {
						data: {
							...user,
							locale: user.locale ?? requestLocale,
						},
					};
				},
				after: async (user, ctx) => {
					const userId = userIdSchema.parse(user.id);

					const { zedToken } = await runPromise(
						acceptInvitation({
							invitationId: organizationInvitationIdSchema.parse(
								ctx?.body?.invitationId,
							),
							userId,
							email: user.email,
						}),
					);

					/** The membership is delivered inline, so the sign-up response
					 * hands its revision to the new session. */
					if (zedToken && ctx)
						ctx.setCookie(
							COOKIES.ZED_TOKEN.name,
							zedToken,
							zedTokenCookieOptions(secureCookiesFor(cfg.auth.url)),
						);

					await runPromise(activateSoleOrganizationForSessions(userId));
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

					const organizationId = await runPromise(
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
	user: {
		additionalFields: {
			locale: {
				type: [
					...LOCALES,
				],
				required: false,
				input: true,
				validator: {
					input: localeSchema,
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
