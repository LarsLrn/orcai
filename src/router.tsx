import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { DefaultErrorBoundary } from "./components/boundaries/default-error";
import { NotFound } from "./components/boundaries/not-found";
import { getRouterBasepath } from "./lib/i18n/router-basepath";
import { routeTree } from "./routeTree.gen";

export function createAppRouter(pathname?: string) {
	const queryClient = new QueryClient();
	const router = createRouter({
		routeTree,
		scrollRestoration: true,
		defaultPreload: "intent",
		basepath: getRouterBasepath(pathname),
		defaultErrorComponent: DefaultErrorBoundary,
		defaultNotFoundComponent: () => <NotFound />,
		context: { queryClient },
	});

	setupRouterSsrQueryIntegration({
		router,
		queryClient,
	});

	return router;
}

declare module "@tanstack/react-router" {
	interface Register {
		router: ReturnType<typeof createRouter>;
	}
}
