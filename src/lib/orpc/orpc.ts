import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { BatchLinkPlugin, DedupeRequestsPlugin } from "@orpc/client/plugins";
import type { RouterClient } from "@orpc/server";
import { createRouterClient } from "@orpc/server";
import { createRouterUtils } from "@orpc/tanstack-query";
import { createIsomorphicFn } from "@tanstack/react-start";
import { getHeaders } from "@tanstack/react-start/server";
import { router } from "./router";

const getORPCClient = createIsomorphicFn()
	.server(() =>
		createRouterClient(router, {
			/**
			 * Provide initial context if needed.
			 *
			 * Because this client instance is shared across all requests,
			 * only include context that's safe to reuse globally.
			 * For per-request context, use middleware context or pass a function as the initial context.
			 */
			context: async () => ({
				headers: getHeaders(), // provide headers if initial context required
			}),
		}),
	)
	.client((): RouterClient<typeof router> => {
		const link = new RPCLink({
			url: `${window.location.origin}/api/rpc`,
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

export const orpc = createRouterUtils(client);
