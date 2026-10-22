import { createHash } from "node:crypto";
import { getAuthenticatorName, passkey } from "@better-auth/passkey";
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
import {
	APIError,
	createAuthMiddleware,
	getSessionFromCtx,
} from "better-auth/api";
import { admin, twoFactor } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import * as Effect from "effect/Effect";
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

/** Paths that finish a sign-in, including the second step of a challenged one. */
const SIGN_IN_COMPLETIONS = [
	"/two-factor/verify-totp",
	"/two-factor/verify-backup-code",
	"/passkey/verify-authentication",
];

/** A passkey replaces the password and the second factor, so the authenticator must have verified the user. */
const requireUserVerified = (userVerified: boolean | undefined) => {
	if (!userVerified)
		throw new APIError("UNAUTHORIZED", {
			code: "PASSKEY_USER_NOT_VERIFIED",
			message: "The passkey did not verify the user.",
		});
};

/**
 * Emails the user about a change to how they sign in. The change has already
 * happened, so a notice that cannot be queued is logged, not answered as an
 * error.
 */
const sendSecurityNotice = (
	type: "auth.two-factor-disabled" | "auth.passkey-added",
	user: User & {
		locale?: string | null;
	},
) =>
	runPromise(
		enqueueNotification(
			{
				type,
				recipient: user.email,
				recipientName: user.name,
				securityUrl: `${cfg.auth.url}/app/account/security`,
				locale: emailLocaleOf(user),
			},
			`${type}:${crypto.randomUUID()}`,
		).pipe(
			Effect.catch((cause) =>
				Effect.logError(`${type} notice not queued`, cause),
			),
		),
	);

const completesSignIn = (path: string) =>
	path.startsWith("/sign-in") || SIGN_IN_COMPLETIONS.includes(path);

export const auth = betterAuth({
	appName: "OrcAI",
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
		twoFactor(),
		passkey({
			// The relying party ID is the host of `baseURL`, so passkeys belong
			// to this domain.
			origin: cfg.auth.url,
			authenticatorSelection: {
				residentKey: "required",
				userVerification: "required",
			},
			registration: {
				afterVerification: ({ verification }) => {
					requireUserVerified(verification.registrationInfo?.userVerified);
					return {
						name: getAuthenticatorName(verification.registrationInfo?.aaguid),
					};
				},
			},
			authentication: {
				afterVerification: ({ verification }) =>
					requireUserVerified(verification.authenticationInfo.userVerified),
			},
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
			twoFactor: dbSchema.twoFactor,
			passkey: dbSchema.passkey,
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
		// A verification link must not open a session the second factor never saw.
		autoSignInAfterVerification: false,
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
		after: createAuthMiddleware(async (ctx) => {
			if (ctx.path === "/two-factor/disable") {
				const disabled = ctx.context.newSession;
				if (!disabled || ctx.context.returned instanceof APIError) return;

				await sendSecurityNotice("auth.two-factor-disabled", disabled.user);
				return;
			}

			if (ctx.path === "/passkey/verify-registration") {
				if (ctx.context.returned instanceof APIError) return;
				const session = await getSessionFromCtx(ctx);
				if (session)
					await sendSecurityNotice("auth.passkey-added", session.user);
				return;
			}

			/** A new browser follows the stored locale; users without one keep
			 * the request's. */
			const user = ctx.context.newSession?.user;
			if (!completesSignIn(ctx.path) || !user) return;

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
