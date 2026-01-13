import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { BatchLinkPlugin, DedupeRequestsPlugin } from "@orpc/client/plugins";
import type { RouterClient } from "@orpc/server";
import { createRouterClient } from "@orpc/server";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import Cookies from "js-cookie";
import { COOKIES, HEADERS } from "@/settings/constants";
import { queryDefaults } from "./query-defaults";
import { router } from "./router";

const getORPCClient = createIsomorphicFn()
	.server(() =>
		createRouterClient(router, {
			context: async () => ({
				reqHeaders: getRequestHeaders(),
			}),
		}),
	)
	.client((): RouterClient<typeof router> => {
		const link = new RPCLink({
			url: `${window.location.origin}/api/rpc`,
			headers: () => {
				const token = Cookies.get(COOKIES.ZED_TOKEN.name);
				return token ? { [HEADERS.X_ZED_TOKEN]: token } : {};
			},
			plugins: [
				new BatchLinkPlugin({
					groups: [
						{
							condition: () => true,
							context: {},
						},
					],
				}),
				new DedupeRequestsPlugin({
					filter: ({ request }) => request.method === "GET", // Filters requests to dedupe
					groups: [
						{
							condition: () => true,
							context: {}, // Context used for the rest of the request lifecycle
						},
					],
				}),
				/**
				 * TODO: Uncomment this when CSRF protection is needed
				 * Adds CSRF protection to the link:
				 * https://orpc.unnoq.com/docs/plugins/simple-csrf-protection
				 */
				/* new SimpleCsrfProtectionLinkPlugin(), */
			],
		});

		return createORPCClient(link);
	});

export const client: RouterClient<typeof router> = getORPCClient();

export const orpc = createTanstackQueryUtils(client, {
	experimental_defaults: {
		...queryDefaults,
	},
});
