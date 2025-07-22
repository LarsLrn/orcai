import { ORPCError, os } from "@orpc/server";
import { getWebRequest } from "@tanstack/react-start/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/drizzle";
import { user } from "@/db/schema/auth";
import { auth as betterAuth } from "@/lib/auth";
import type { authClient } from "@/lib/auth-client";

export const requiredAuthMiddleware = os
	.$context<{
		auth?: {
			isAuthenticated?: boolean;
			session?: typeof authClient.$Infer.Session.session;
			user?: typeof authClient.$Infer.Session.user;
		};
	}>()
	.errors({
		UNAUTHORIZED: {
			message: "You must be logged in to access this resource.",
			status: 401,
		},
	})
	.middleware(async ({ context, next }) => {
		/**
		 * Why we should ?? here?
		 * Because it can avoid `getSession` being called when unnecessary.
		 * {@link https://orpc.unnoq.com/docs/best-practices/dedupe-middleware}
		 */
		const { headers } = getWebRequest();

		const auth = context.auth ?? (await betterAuth.api.getSession({ headers }));

		if (!auth?.session || !auth?.user) {
			throw new ORPCError("UNAUTHORIZED", {
				message: "You must be logged in to access this resource.",
			});
		}

		return next({
			context: {
				auth: {
					isAuthenticated: true,
					session: auth.session,
					user: auth.user,
				},
			},
		});
	});

export const requireActiveOrganizationMiddleware = os
	.$context<{
		auth: {
			isAuthenticated: true;
			session: typeof authClient.$Infer.Session.session;
			user: typeof authClient.$Infer.Session.user;
		};
	}>()
	.errors({
		BAD_REQUEST: {
			message: "No active organization for the current session.",
			status: 400,
		},
	})
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
	});

export const requirePreferencesMiddleware = os
	.$context<{
		auth: {
			isAuthenticated: true;
			session: typeof authClient.$Infer.Session.session;
			user: typeof authClient.$Infer.Session.user;
		};
	}>()
	.errors({
		NOT_FOUND: {
			message: "User preferences not found.",
			status: 404,
		},
	})
	.middleware(async ({ context, next }) => {
		const [userPrefs] = await db
			.select({ preferences: user.preferences })
			.from(user)
			.where(eq(user.id, context.auth.user.id));

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
	});
