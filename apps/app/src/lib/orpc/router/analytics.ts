import {
	instanceAnalytics,
	organizationAnalytics,
} from "@/lib/analytics/usage-analytics";
import { readRevision } from "@/lib/authz/zed-token";
import { authed } from "@/lib/orpc/implementation/authed";
import { requireInstanceAdminMiddleware } from "@/lib/orpc/middlewares/auth";
import { requireOrganization } from "@/lib/orpc/middlewares/organization";

const organization = authed.analytics.organization
	.use(requireOrganization("view_analytics"))
	.effect(function* ({ input, context }) {
		return {
			data: yield* organizationAnalytics({
				organizationId: context.auth.session.activeOrganizationId,
				days: input.days,
				viewer: {
					userId: context.auth.user.id,
					zedToken: readRevision(context),
				},
			}),
		};
	});

const instance = authed.analytics.instance
	.use(requireInstanceAdminMiddleware)
	.effect(function* ({ input }) {
		return {
			data: yield* instanceAnalytics({
				days: input.days,
			}),
		};
	});

export const analyticsRouter = {
	organization,
	instance,
};
