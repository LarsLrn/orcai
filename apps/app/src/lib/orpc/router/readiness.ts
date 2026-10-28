import { authed } from "@/lib/orpc/implementation/authed";
import { requireOrganizationPermission } from "@/lib/orpc/middlewares/permission";
import { organizationReadiness } from "@/lib/readiness/readiness";

// Every required item is an admin capability, so the checklist is for admins.
const organization = authed.readiness.organization
	.use(requireOrganizationPermission("manage_organization"))
	.effect(function* ({ context }) {
		return {
			data: yield* organizationReadiness(
				context.auth.session.activeOrganizationId,
			),
		};
	});

export const readinessRouter = {
	organization,
};
