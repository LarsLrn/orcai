import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { RouterClient } from "@orpc/server";
import { createRouterClient } from "@orpc/server";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { createORPCContext } from "@/lib/orpc/implementation/context";
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
		});

		return createORPCClient(link);
	});

export const client: RouterClient<typeof router> = getORPCClient();

export const orpc = createTanstackQueryUtils(client, {
	scoped: {
		...queryDefaults,
	},
});
