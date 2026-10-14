import { DB } from "@orcai/db";
import { organizationIdSchema, userIdSchema } from "@orcai/schema";
import { os } from "@orpc/server";
import * as Effect from "effect/Effect";
import { auth as betterAuth } from "@/lib/auth/auth";
import type { authClient } from "@/lib/auth/auth-client";
import { isInstanceAdminRole } from "@/lib/authz/instance-role";
import * as AppErrors from "@/lib/effect/utils/errors";
import { runMiddlewareEffect } from "@/lib/effect/utils/orpc-helpers";
import { withName } from "@/lib/orpc/middlewares/utils";
import type { AuthContext } from ".";

export const requiredAuthMiddleware = withName(
	os
		.$context<{
			reqHeaders?: Headers | undefined;
			auth?: {
				isAuthenticated?: boolean;
				session?: typeof authClient.$Infer.Session.session;
				user?: typeof authClient.$Infer.Session.user;
			};
		}>()
		.middleware(async (opts) =>
			runMiddlewareEffect(
				opts,
				Effect.gen(function* () {
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

					const auth = opts.context.auth
						? opts.context.auth
						: yield* Effect.tryPromise({
								try: () =>
									betterAuth.api.getSession({
										headers,
									}),
								catch: () =>
									new AppErrors.BadRequestError({
										reason: "SESSION_NOT_FOUND",
										message: "Authentication session not found.",
									}),
							});

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

					return yield* Effect.promise(() =>
						Promise.resolve(
							opts.next({
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
							}),
						),
					);
				}),
			),
		),
	"requiredAuth",
);

export const requireActiveOrganizationMiddleware = withName(
	os.$context<AuthContext>().middleware((opts) =>
		runMiddlewareEffect(
			opts,
			Effect.gen(function* () {
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
							message:
								"You are no longer a member of the selected organization.",
							data: {
								permission: "read",
								entityType: "organization",
							},
						}),
					);
				}

				return yield* Effect.promise(() =>
					Promise.resolve(
						opts.next({
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
						}),
					),
				);
			}),
		),
	),
	"requireActiveOrganization",
);

export const requirePreferencesMiddleware = withName(
	os.$context<AuthContext>().middleware((opts) =>
		runMiddlewareEffect(
			opts,
			Effect.gen(function* () {
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

				return yield* Effect.promise(() =>
					Promise.resolve(
						opts.next({
							context: {
								preferences: userPrefs.preferences,
							},
						}),
					),
				);
			}),
		),
	),
	"requirePreferences",
);

/** Requires the instance admin role on `user.role`, which grants nothing inside an organisation. */
export const requireInstanceAdminMiddleware = withName(
	os.$context<AuthContext>().middleware((opts) =>
		runMiddlewareEffect(
			opts,
			Effect.gen(function* () {
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

				return yield* Effect.promise(() => Promise.resolve(opts.next()));
			}),
		),
	),
	"requireInstanceAdmin",
);
