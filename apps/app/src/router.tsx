import { RPCJsonSerializer } from "@orpc/client";
import { QueryClient } from "@tanstack/react-query";
import { type AnyRouteMatch, createRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { DefaultErrorBoundary } from "./components/boundaries/default-error";
import { NotFound } from "./components/boundaries/not-found";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
	const serializer = new RPCJsonSerializer();

	const queryClient = new QueryClient({
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

	interface StaticDataRouteOption {
		/** Where the crumb of a route that is no page of its own leads. */
		breadcrumbTo?: (matches: AnyRouteMatch[]) => string | undefined;
	}
}
