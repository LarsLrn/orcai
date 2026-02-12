import { ORPCError } from "@orpc/server";
import * as Effect from "effect/Effect";
import { auth as betterAuth } from "@/lib/auth";
import type { authClient } from "@/lib/auth-client";
import { DB } from "@/lib/effect/services/drizzle";
import { runOrpcEffect } from "@/lib/effect/utils/orpc-helpers";
import { os } from "@/lib/orpc/implementation/os";
import { withName } from "./utils";

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
								try: () => betterAuth.api.getSession({ headers }),
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

					return next({
						context: {
							...context,
							auth: {
								isAuthenticated: true as const,
								session: auth.session,
								user: auth.user,
							},
						},
					});
				}),
			),
		),
	"requiredAuth",
);

export const requireActiveOrganizationMiddleware = withName(
	os
		.$context<{
			auth: {
				isAuthenticated: true;
				session: typeof authClient.$Infer.Session.session;
				user: typeof authClient.$Infer.Session.user;
			};
		}>()
		.middleware(({ context, next }) =>
			runOrpcEffect(
				Effect.gen(function* () {
					const activeOrganizationId =
						context.auth.session.activeOrganizationId;

					if (!activeOrganizationId) {
						return yield* Effect.fail(
							new ORPCError("BAD_REQUEST", {
								message: "No active organization for the current session.",
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
	os
		.$context<{
			auth: {
				isAuthenticated: true;
				session: typeof authClient.$Infer.Session.session;
				user: typeof authClient.$Infer.Session.user;
			};
		}>()
		.middleware(async ({ context, next }) =>
			runOrpcEffect(
				Effect.gen(function* () {
					const db = yield* DB;

					const userPrefs = yield* db.query.user
						.findFirst({
							where: {
								id: context.auth.user.id,
							},
							columns: {
								preferences: true,
							},
						})
						.pipe(
							Effect.flatMap((prefs) =>
								Effect.fromNullable(prefs).pipe(
									Effect.orElse(() =>
										Effect.fail(
											new ORPCError("NOT_FOUND", {
												message: "User preferences not found.",
											}),
										),
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
