import type { ContractOutputs } from "@orcai/contracts";
import { RPCJsonSerializer } from "@orpc/client";
import { MutationCache, QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import Cookies from "js-cookie";
import { DefaultErrorBoundary } from "./components/boundaries/default-error";
import { NotFound } from "./components/boundaries/not-found";
import { deLocalizeUrl, localizeUrl } from "./paraglide/runtime";
import { routeTree } from "./routeTree.gen";
import { COOKIES } from "./settings/constants";

export function getRouter() {
	const serializer = new RPCJsonSerializer();

	const queryClient = new QueryClient({
		mutationCache: new MutationCache({
			onSuccess: (data) => {
				// Provides just a tiny bit of type safety, assuming all procedures follow the same meta structure (which they should)
				const d = data as ContractOutputs["chat"]["create"];
				// Global listener: If ANY mutation returns a zedToken, save it.
				if (d.meta?.zedToken) {
					Cookies.set(COOKIES.ZED_TOKEN.name, d.meta.zedToken, {
						expires: COOKIES.ZED_TOKEN.expires,
					});
				}
			},
		}),
		defaultOptions: {
			queries: {
				queryKeyHashFn(queryKey) {
					const serialized = serializer.serialize(queryKey);
					return JSON.stringify(serialized);
				},
				staleTime: 60 * 1000, // > 0 to prevent immediate refetching on mount
			},
			dehydrate: {
				serializeData(data) {
					const serialized = serializer.serialize(data);
					return serialized;
				},
			},
			hydrate: {
				deserializeData(data) {
					return serializer.deserialize(data);
				},
			},
		},
	});

	const router = createRouter({
		routeTree,
		defaultViewTransition: true,
		rewrite: {
			input: ({ url }) => deLocalizeUrl(url),
			output: ({ url }) => localizeUrl(url),
		},
		scrollRestoration: true,
		defaultPreload: "intent",
		defaultErrorComponent: DefaultErrorBoundary,
		defaultNotFoundComponent: () => <NotFound />,
		context: {
			queryClient,
		},
	});

	setupRouterSsrQueryIntegration({
		router,
		queryClient,
	});

	return router;
}

declare module "@tanstack/react-router" {
	interface Register {
		router: ReturnType<typeof getRouter>;
	}
}
