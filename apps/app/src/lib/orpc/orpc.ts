import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { BatchLinkPlugin, DedupeLinkPlugin } from "@orpc/client/plugins";
import type { RouterClient } from "@orpc/server";
import { createRouterClient } from "@orpc/server";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import Cookies from "js-cookie";
import { createORPCContext } from "@/lib/orpc/implementation/context";
import { COOKIES, HEADERS } from "@/settings/constants";
import { queryDefaults } from "./query-defaults";
import { router } from "./router";

const getORPCClient = createIsomorphicFn()
	.server(() =>
		createRouterClient(router, {
			// Resolve request headers lazily so this shared client can be created
			// at module scope without requiring an active request event.
			context: () =>
				createORPCContext({
					reqHeaders: getRequestHeaders(),
				}),
		}),
	)
	.client((): RouterClient<typeof router> => {
		const link = new RPCLink({
			url: "/api/rpc",
			headers: () => {
				const token = Cookies.get(COOKIES.ZED_TOKEN.name);
				return token
					? {
							[HEADERS.X_ZED_TOKEN]: token,
						}
					: {};
			},
			plugins: [
				new BatchLinkPlugin({
					filter: ({ path }) => path[0] !== "ai",
					groups: [
						{
							condition: () => true,
							context: {},
						},
					],
				}),
				new DedupeLinkPlugin({
					filter: ({ request }) => request.method === "GET", // Filters requests to dedupe
					groups: [
						{
							condition: () => true,
							context: {}, // Context used for the rest of the request lifecycle
						},
					],
				}),
			],
		});

		return createORPCClient(link);
	});

export const client: RouterClient<typeof router> = getORPCClient();

export const orpc = createTanstackQueryUtils(client, {
	scoped: {
		...queryDefaults,
	},
});
