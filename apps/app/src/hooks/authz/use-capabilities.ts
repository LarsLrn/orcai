import type { OrganizationCapability } from "@orcai/schema";
import { useQuery } from "@tanstack/react-query";

export { filterByCapabilities } from "@/lib/authz/capability-filter";

import { orpc } from "@/lib/orpc/orpc";

export const useOrganizationCapabilities = (
	permissions?: readonly OrganizationCapability[],
) =>
	useQuery(
		orpc.authorization.organizationCapabilities.queryOptions({
			input: {
				permissions: permissions
					? [
							...permissions,
						]
					: undefined,
			},
		}),
	);
