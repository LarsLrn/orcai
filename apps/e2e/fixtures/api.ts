import type { ContractClient } from "@orcai/contracts";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";

export type ApiClient = ContractClient;

/** A typed oRPC client for `/api/rpc`, acting as the session behind `cookieHeader`. */
export const createApiClient = (
	baseURL: string,
	cookieHeader?: string,
): ApiClient => {
	const link = new RPCLink({
		origin: baseURL,
		url: "/api/rpc",
		headers: cookieHeader
			? {
					cookie: cookieHeader,
				}
			: {},
	});

	return createORPCClient(link);
};
