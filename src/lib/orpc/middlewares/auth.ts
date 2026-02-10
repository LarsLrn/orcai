import { ORPCError } from "@orpc/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/drizzle";
import { dbSchema } from "@/db/schema";
import { auth as betterAuth } from "@/lib/auth";
import type { authClient } from "@/lib/auth-client";
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
		.middleware(async ({ context, next }) => {
			if (!context.reqHeaders) {
				throw new ORPCError("BAD_REQUEST", {
					message: "Request headers are required for authentication.",
				});
			}

			const auth =
				context.auth ??
				(await betterAuth.api.getSession({ headers: context.reqHeaders }));

			if (!auth?.session || !auth?.user) {
				throw new ORPCError("UNAUTHORIZED", {
					message: "You must be logged in to access this resource.",
				});
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
		.middleware(({ context, next }) => {
			if (!context.auth.session.activeOrganizationId) {
				throw new ORPCError("BAD_REQUEST", {
					message: "No active organization for the current session.",
				});
			}

			return next({
				context: {
					auth: {
						...context.auth,
						session: {
							...context.auth.session,
							activeOrganizationId: context.auth.session.activeOrganizationId,
						},
					},
				},
			});
		}),
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
		.middleware(async ({ context, next }) => {
			const [userPrefs] = await db
				.select({ preferences: dbSchema.user.preferences })
				.from(dbSchema.user)
				.where(eq(dbSchema.user.id, context.auth.user.id));

			if (!userPrefs) {
				throw new ORPCError("NOT_FOUND", {
					message: "User preferences not found.",
				});
			}

			return next({
				context: {
					preferences: userPrefs.preferences,
				},
			});
		}),
	"requirePreferences",
);
