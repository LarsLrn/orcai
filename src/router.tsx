import { StandardRPCJsonSerializer } from "@orpc/client/standard";
import { MutationCache, QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import Cookies from "js-cookie";
import { DefaultErrorBoundary } from "./components/boundaries/default-error";
import { NotFound } from "./components/boundaries/not-found";
import type { OrpcOutputs } from "./lib/orpc/contracts";
import { deLocalizeUrl, localizeUrl } from "./paraglide/runtime";
import { routeTree } from "./routeTree.gen";
import { COOKIES } from "./settings/constants";

export function getRouter() {
	const serializer = new StandardRPCJsonSerializer();

	const queryClient = new QueryClient({
		mutationCache: new MutationCache({
			onSuccess: (data) => {
				// Provides just a tiny bit of type safety, assuming all procedures follow the same meta structure (which they should)
				const d = data as OrpcOutputs["chat"]["create"];
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
					const [json, meta] = serializer.serialize(queryKey);
					return JSON.stringify({
						json,
						meta,
					});
				},
				staleTime: 60 * 1000, // > 0 to prevent immediate refetching on mount
			},
			dehydrate: {
				serializeData(data) {
					const [json, meta] = serializer.serialize(data);
					return {
						json,
						meta,
					};
				},
			},
			hydrate: {
				deserializeData(data) {
					return serializer.deserialize(data.json, data.meta);
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
