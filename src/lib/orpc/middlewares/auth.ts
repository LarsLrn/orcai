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
	.middleware(async ({ context, next }) => {
		/**
		 * Why we should ?? here?
		 * Because it can avoid `getSession` being called when unnecessary.
		 * {@link https://orpc.unnoq.com/docs/best-practices/dedupe-middleware}
		 */
		const { headers } = getWebRequest();

		const auth = context.auth ?? (await betterAuth.api.getSession({ headers }));

		if (!auth?.session || !auth?.user) {
			throw new ORPCError("UNAUTHORIZED");
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
	.middleware(async ({ context, next }) => {
		if (!context.auth.session.activeOrganizationId) {
			throw new ORPCError("NOT_FOUND");
		}

		return next({
			context: {
				activeOrganizationId: context.auth.session.activeOrganizationId,
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
	.middleware(async ({ context, next }) => {
		const [userPrefs] = await db
			.select({ preferences: user.preferences })
			.from(user)
			.where(eq(user.id, context.auth.user.id));

		return next({
			context: {
				preferences: userPrefs.preferences,
			},
		});
	});
