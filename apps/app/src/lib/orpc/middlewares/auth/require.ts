import { DB } from "@orcai/db";
import { organizationIdSchema, userIdSchema } from "@orcai/schema";
import * as Effect from "effect/Effect";
import { auth as betterAuth } from "@/lib/auth/auth";
import type { authClient } from "@/lib/auth/auth-client";
import * as AppErrors from "@/lib/effect/utils/errors";
import { runMiddlewareEffect } from "@/lib/effect/utils/orpc-helpers";
import { os } from "@/lib/orpc/implementation/os";
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
					const headers = opts.context.reqHeaders;

					if (!headers) {
						return yield* Effect.fail(
							new AppErrors.BadRequestError({
								message: "Request headers are required for authentication.",
							}),
						);
					}

					const auth = opts.context.auth
						? opts.context.auth
						: yield* Effect.tryPromise({
								try: () =>
									betterAuth.api.getSession({
										headers,
									}),
								catch: () =>
									new AppErrors.BadRequestError({
										message: "Authentication session not found.",
									}),
							});

					if (!auth?.session || !auth?.user) {
						return yield* Effect.fail(
							new AppErrors.UnauthorizedError({
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
							message:
								"An active organization must be selected to access this resource.",
						}),
					);
				}

				return yield* Effect.promise(() =>
					Promise.resolve(
						opts.next({
							context: {
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
											message: "User preferences not found",
											data: {
												id: opts.context.auth.user.id,
											},
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
