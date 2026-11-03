import { createRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { getGlobalStartContext } from "@tanstack/react-start";
import type { ReactElement, ReactNode } from "react";
import { DefaultErrorBoundary } from "./components/boundaries/default-error";
import { NotFound } from "./components/boundaries/not-found";
import { createQueryClient } from "./lib/orpc/query-client";
import { parseSearch, stringifySearch } from "./lib/router/search-params";
import { pageViewTransitionTypes } from "./lib/router/view-transitions";
import { routeTree } from "./routeTree.gen";

// Typed here because the request context's type depends on the router's.
const requestNonce = (): string | undefined => getGlobalStartContext()?.nonce;

export function getRouter() {
	const queryClient = createQueryClient();

	const router = createRouter({
		routeTree,
		parseSearch,
		stringifySearch,
		defaultViewTransition: {
			types: pageViewTransitionTypes,
		},
		scrollRestoration: true,
		defaultPreload: "intent",
		defaultErrorComponent: DefaultErrorBoundary,
		defaultNotFoundComponent: () => <NotFound />,
		context: {
			queryClient,
		},
		ssr: {
			nonce: requestNonce(),
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
		server: {
			requestContext: {
				/** Allows the server-rendered inline scripts under the Content Security Policy. */
				nonce: string;
			};
		};
	}

	interface StaticDataRouteOption {
		/** Turns the header's last crumb, the page's title, into a menu it opens; the trigger may be disabled. */
		titleMenu?: (props: {
			children: ReactElement<{
				disabled?: boolean;
			}>;
		}) => ReactNode;
	}
}
