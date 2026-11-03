import type { OrganizationCapability } from "@orcai/schema";
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
