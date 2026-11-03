import type { OrganizationCapability } from "@orcai/schema";
import { useQuery } from "@tanstack/react-query";
import { organizationCapabilitiesQuery } from "@/lib/authz/organization-capabilities-query";

export { filterByCapabilities } from "@/lib/authz/capability-filter";

export const useOrganizationCapabilities = (
	permissions?: readonly OrganizationCapability[],
) => useQuery(organizationCapabilitiesQuery(permissions));
