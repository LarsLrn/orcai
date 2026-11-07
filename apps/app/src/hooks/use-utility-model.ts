import { useRouteContext } from "@tanstack/react-router";
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

	return {
		organizationId: auth.session.activeOrganizationId,
		loading: status === "pending",
		available: Boolean(organization?.data.utilityModelId),
		canChoose: hasCapability(
			capabilities?.data.capabilities,
			"manage_organization",
		),
	};
};
