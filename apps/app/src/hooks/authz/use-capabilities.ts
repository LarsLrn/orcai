import { useQuery } from "@tanstack/react-query";
import { organizationCapabilitiesQuery } from "@/lib/authz/organization-capabilities-query";

export { filterByCapabilities } from "@/lib/authz/capability-filter";

export const useOrganizationCapabilities = () =>
	useQuery(organizationCapabilitiesQuery());
