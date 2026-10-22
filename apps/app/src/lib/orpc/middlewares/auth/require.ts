import { DB } from "@orcai/db";
import { organizationIdSchema, userIdSchema } from "@orcai/schema";
import { middlewareGen } from "@orpc/experimental-effect";
import { os } from "@orpc/server";
import * as Effect from "effect/Effect";
import { auth as betterAuth } from "@/lib/auth/auth";
import { requiresTwoFactor } from "@/lib/auth/two-factor-policy";
import { isInstanceAdminRole } from "@/lib/authz/instance-role";
import { AppConfigService } from "@/lib/effect/services/config";
import * as AppErrors from "@/lib/effect/utils/errors";
import { recordRequestUser } from "@/lib/observability/request-span";
import type { AppEffectContext } from "@/lib/orpc/implementation/os";
import { withName } from "@/lib/orpc/middlewares/utils";
import type { AuthContext } from ".";

type IncomingAuth = {
	isAuthenticated?: boolean;
	session?: typeof betterAuth.$Infer.Session.session;
	user?: typeof betterAuth.$Infer.Session.user;
};

/** The session a surrounding procedure already resolved, so a nested procedure call keeps it. */
const resolvedAuth = (auth: IncomingAuth | undefined) =>
	auth?.isAuthenticated === true && auth.session && auth.user
		? auth
		: undefined;

export const requiredAuthMiddleware = withName(
	os
		.$context<
			AppEffectContext & {
				reqHeaders?: Headers | undefined;
				auth?: IncomingAuth;
			}
		>()
		.middleware(
			middlewareGen(function* (opts) {
				const headers = yield* Effect.fromNullishOr(
					opts.context.reqHeaders,
				).pipe(
					Effect.mapError(
						() =>
							new AppErrors.BadRequestError({
								reason: "REQUEST_HEADERS_REQUIRED",
								message: "Request headers are required for authentication.",
							}),
					),
				);

				// getSession answers null without a session, so a throw is a backend failure.
				const auth =
					resolvedAuth(opts.context.auth) ??
					(yield* Effect.tryPromise(() =>
						betterAuth.api.getSession({
							headers,
						}),
					));

				if (!auth?.session || !auth?.user) {
					return yield* Effect.fail(
						new AppErrors.UnauthorizedError({
							reason: "AUTH_REQUIRED",
							message: "You must be logged in to access this resource.",
						}),
					);
				}

				const { session, user } = auth;
				const activeOrganizationId = session.activeOrganizationId;
				recordRequestUser(user.id);

				const { config } = yield* AppConfigService;
				if (requiresTwoFactor(config.auth.twoFactorPolicy, user)) {
					return yield* Effect.fail(
						new AppErrors.ForbiddenError({
							reason: "TWO_FACTOR_REQUIRED",
							message: "Set up two-factor authentication to continue.",
						}),
					);
				}

				return yield* opts.next({
					context: {
						reqHeaders: headers,
						auth: {
							isAuthenticated: true as const,
							session: {
								...session,
								activeOrganizationId:
									activeOrganizationId == null
										? undefined
										: organizationIdSchema.parse(activeOrganizationId),
							},
							user: {
								...user,
								id: userIdSchema.parse(user.id),
							},
						},
					} satisfies AuthContext,
				});
			}),
		),
	"requiredAuth",
);

export const requireActiveOrganizationMiddleware = withName(
	os.$context<AppEffectContext & AuthContext>().middleware(
		middlewareGen(function* (opts) {
			const activeOrganizationId =
				opts.context.auth.session.activeOrganizationId;

			if (!activeOrganizationId) {
				return yield* Effect.fail(
					new AppErrors.BadRequestError({
						reason: "ACTIVE_ORGANIZATION_REQUIRED",
						message:
							"An active organization must be selected to access this resource.",
					}),
				);
			}

			const db = yield* DB;
			const membership = yield* db.query.member.findFirst({
				where: {
					organizationId: {
						eq: activeOrganizationId,
					},
					userId: {
						eq: opts.context.auth.user.id,
					},
				},
				columns: {
					id: true,
				},
			});

			if (!membership) {
				return yield* Effect.fail(
					new AppErrors.ForbiddenError({
						reason: "ORGANIZATION_MEMBERSHIP_REVOKED",
						message: "You are no longer a member of the selected organization.",
						data: {
							permission: "read",
							entityType: "organization",
						},
					}),
				);
			}

			return yield* opts.next({
				context: {
					reqHeaders: opts.context.reqHeaders,
					auth: {
						...opts.context.auth,
						session: {
							...opts.context.auth.session,
							activeOrganizationId,
						},
					},
				},
			});
		}),
	),
	"requireActiveOrganization",
);

export const requirePreferencesMiddleware = withName(
	os.$context<AppEffectContext & AuthContext>().middleware(
		middlewareGen(function* (opts) {
			const db = yield* DB;

			const userPrefs = yield* db.query.user
				.findFirst({
					where: {
						id: {
							eq: opts.context.auth.user.id,
						},
					},
					columns: {
						preferences: true,
					},
				})
				.pipe(
					Effect.flatMap((prefs) =>
						Effect.fromNullishOr(prefs).pipe(
							Effect.mapError(
								() =>
									new AppErrors.NotFoundError({
										reason: "USER_PREFERENCES_NOT_FOUND",
										id: opts.context.auth.user.id,
										message: "User preferences not found",
									}),
							),
						),
					),
				);

			return yield* opts.next({
				context: {
					preferences: userPrefs.preferences,
				},
			});
		}),
	),
	"requirePreferences",
);

/** Requires the instance admin role on `user.role`, which grants nothing inside an organisation. */
export const requireInstanceAdminMiddleware = withName(
	os.$context<AppEffectContext & AuthContext>().middleware(
		middlewareGen(function* (opts) {
			if (!isInstanceAdminRole(opts.context.auth.user.role)) {
				return yield* Effect.fail(
					new AppErrors.ForbiddenError({
						reason: "INSTANCE_ADMIN_REQUIRED",
						message: "This action requires the instance administrator.",
						data: {
							permission: "administer_instance",
							entityType: "instance",
						},
					}),
				);
			}

			return yield* opts.next();
		}),
	),
	"requireInstanceAdmin",
);
