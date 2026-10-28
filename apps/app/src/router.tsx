import { createHydrationOptions } from "@orpc/tanstack-query";
import { QueryClient } from "@tanstack/react-query";
import { type AnyRouteMatch, createRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import type { ReactElement, ReactNode } from "react";
import { DefaultErrorBoundary } from "./components/boundaries/default-error";
import { NotFound } from "./components/boundaries/not-found";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				staleTime: 60 * 1000, // > 0 to prevent immediate refetching on mount
			},
			...createHydrationOptions(),
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
		/** Turns the header's last crumb, the page's title, into a menu it opens; the trigger may be disabled. */
		titleMenu?: (props: {
			children: ReactElement<{
				disabled?: boolean;
			}>;
		}) => ReactNode;
	}
}
