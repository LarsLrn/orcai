import { useHydrated, useRouteContext } from "@tanstack/react-router";
import { useOrganizationCapabilities } from "@/hooks/authz/use-capabilities";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { hasCapability } from "@/lib/authz/capabilities";

/** Whether the active organisation has a utility model, which generates asset metadata, and whether the user may choose one. */
export const useUtilityModel = () => {
	const { auth } = useRouteContext({
		from: "/app",
	});
	const { data: organization, status } = useActiveOrganization();
	const { data: capabilities } = useOrganizationCapabilities();
	// The server renders the query as pending even when its data reaches the
	// browser before hydration, and hydration keeps the server's attributes.
	const hydrated = useHydrated();

	return {
		organizationId: auth.session.activeOrganizationId,
		loading: !hydrated || status === "pending",
		available: hydrated && Boolean(organization?.data.utilityModelId),
		canChoose: hasCapability(
			capabilities?.data.capabilities,
			"manage_organization",
		),
	};
};
