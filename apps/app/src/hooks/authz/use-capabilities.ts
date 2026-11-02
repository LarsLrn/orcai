import type { OrganizationCapability } from "@orcai/schema";
import { useQuery } from "@tanstack/react-query";

export { filterByCapabilities } from "@/lib/authz/capability-filter";

import { orpc } from "@/lib/orpc/orpc";

/** The user's capabilities in the active organisation, all of them without `permissions`. */
export const organizationCapabilitiesQuery = (
	permissions?: readonly OrganizationCapability[],
) =>
	orpc.authorization.organizationCapabilities.queryOptions({
		input: {
			permissions: permissions
				? [
						...permissions,
					]
				: undefined,
		},
	});

export const useOrganizationCapabilities = (
	permissions?: readonly OrganizationCapability[],
) => useQuery(organizationCapabilitiesQuery(permissions));
