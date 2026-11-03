import { orpc } from "@/lib/orpc/orpc";

/** All of the user's capabilities in the active organisation. `/app` loads it, so the server renders with it. */
export const organizationCapabilitiesQuery = () =>
	orpc.authorization.organizationCapabilities.queryOptions({
		input: {},
	});
