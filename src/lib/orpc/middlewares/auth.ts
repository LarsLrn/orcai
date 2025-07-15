import { ORPCError, os } from "@orpc/server";
import { getWebRequest } from "@tanstack/react-start/server";
import { auth } from "@/lib/auth";
import type { authClient } from "@/lib/auth-client";

export const requiredAuthMiddleware = os
	.$context<{ session?: typeof authClient.$Infer.Session }>()
	.middleware(async ({ context, next }) => {
		/**
		 * Why we should ?? here?
		 * Because it can avoid `getSession` being called when unnecessary.
		 * {@link https://orpc.unnoq.com/docs/best-practices/dedupe-middleware}
		 */
		const { headers } = getWebRequest();

		const session = context.session ?? (await auth.api.getSession({ headers }));

		if (!session?.user) {
			throw new Error("UNAUTHORIZED");
		}

		return next({
			context: { session },
		});
	});

export const requireActiveCourseMiddleware = os
	.$context<{ session: typeof authClient.$Infer.Session }>()
	.middleware(async ({ context, next }) => {
		if (!context.session.session.activeCourseId) {
			throw new ORPCError("NOT_FOUND");
		}

		return next({
			context: { activeCourseId: context.session.session.activeCourseId },
		});
	});

export const requireActiveOrganizationMiddleware = os
	.$context<{ session: typeof authClient.$Infer.Session }>()
	.middleware(async ({ context, next }) => {
		if (!context.session.session.activeOrganizationId) {
			throw new ORPCError("NOT_FOUND");
		}

		return next({
			context: {
				activeOrganizationId: context.session.session.activeOrganizationId,
			},
		});
	});
