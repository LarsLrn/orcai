import { DB } from "@orcai/db";
import { organizationIdSchema, userIdSchema } from "@orcai/schema";
import * as Effect from "effect/Effect";
import { auth as betterAuth } from "@/lib/auth/auth";
import type { authClient } from "@/lib/auth/auth-client";
import { runOrpcEffect } from "@/lib/effect/utils/orpc-helpers";
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
		.middleware(async ({ context, errors, next }) =>
			runOrpcEffect(
				Effect.gen(function* () {
					const headers = context.reqHeaders;

					if (!headers) {
						return yield* Effect.fail(
							errors.BAD_REQUEST({
								message: "Request headers are required for authentication.",
							}),
						);
					}

					const auth = context.auth
						? context.auth
						: yield* Effect.tryPromise({
								try: () =>
									betterAuth.api.getSession({
										headers,
									}),
								catch: () =>
									errors.BAD_REQUEST({
										message: "Authentication session not found.",
									}),
							});

					if (!auth?.session || !auth?.user) {
						return yield* Effect.fail(
							errors.UNAUTHORIZED({
								message: "You must be logged in to access this resource.",
							}),
						);
					}

					const activeOrganizationId = auth.session.activeOrganizationId;

					return next({
						context: {
							...context,
							auth: {
								isAuthenticated: true as const,
								session: {
									...auth.session,
									activeOrganizationId:
										activeOrganizationId == null
											? undefined
											: organizationIdSchema.parse(activeOrganizationId),
								},
								user: {
									...auth.user,
									id: userIdSchema.parse(auth.user.id),
								},
							},
						} satisfies AuthContext,
					});
				}),
			),
		),
	"requiredAuth",
);

export const requireActiveOrganizationMiddleware = withName(
	os.$context<AuthContext>().middleware(({ context, errors, next }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const activeOrganizationId = context.auth.session.activeOrganizationId;

				if (!activeOrganizationId) {
					return yield* Effect.fail(
						errors.BAD_REQUEST({
							message:
								"An active organization must be selected to access this resource.",
						}),
					);
				}

				return next({
					context: {
						auth: {
							...context.auth,
							session: {
								...context.auth.session,
								activeOrganizationId,
							},
						},
					},
				});
			}),
		),
	),
	"requireActiveOrganization",
);

export const requirePreferencesMiddleware = withName(
	os.$context<AuthContext>().middleware(async ({ context, errors, next }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;

				const userPrefs = yield* db.query.user
					.findFirst({
						where: {
							id: {
								eq: context.auth.user.id,
							},
						},
						columns: {
							preferences: true,
						},
					})
					.pipe(
						Effect.flatMap((prefs) =>
							Effect.fromNullishOr(prefs).pipe(
								Effect.mapError(() =>
									errors.NOT_FOUND({
										message: "User preferences not found",
										data: {
											id: context.auth.user.id,
											organizationId:
												context.auth.session.activeOrganizationId ??
												context.auth.user.id,
											userId: context.auth.user.id,
										},
									}),
								),
							),
						),
					);

				return next({
					context: {
						preferences: userPrefs.preferences,
					},
				});
			}),
		),
	),
	"requirePreferences",
);
