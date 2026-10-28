import { useQuery } from "@tanstack/react-query";
import { useHydrated, useRouteContext } from "@tanstack/react-router";
import { useOrganizationCapabilities } from "@/hooks/authz/use-capabilities";
import { hasCapability } from "@/lib/authz/capabilities";
import { orpc } from "@/lib/orpc/orpc";

/** Whether the active organisation has a utility model, which generates asset metadata, and whether the user may choose one. */
export const useUtilityModel = () => {
	const { auth } = useRouteContext({
		from: "/app",
	});
	const { data: organization, status } = useQuery(
		orpc.organization.find.queryOptions({
			input: {
				id: auth.session.activeOrganizationId,
			},
		}),
	);
	const { data: capabilities } = useOrganizationCapabilities([
		"manage_organization",
	]);
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
