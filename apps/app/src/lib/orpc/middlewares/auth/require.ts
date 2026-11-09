import { DB } from "@orcai/db";
import { organizationIdSchema, userIdSchema } from "@orcai/schema";
import { middlewareGen } from "@orpc/effect";
import { os } from "@orpc/server";
import * as Effect from "effect/Effect";
import type { auth as betterAuth } from "@/lib/auth/auth";
import { requireSignedIn, signedInSession } from "@/lib/auth/signed-in";
import * as AppErrors from "@/lib/effect/utils/errors";
import { isInstanceAdminRole } from "@/lib/instance/instance-role";
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

				const resolved = resolvedAuth(opts.context.auth);
				const { session, user } = resolved
					? yield* requireSignedIn(resolved)
					: yield* signedInSession(headers);
				const activeOrganizationId = session.activeOrganizationId;

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
