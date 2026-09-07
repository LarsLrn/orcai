import { useRouteContext } from "@tanstack/react-router";

/**
 * Reads authenticated user/session data without coupling shared UI to a route scope.
 * Authenticated shells guarantee this invariant before rendering their children.
 */
export const useAuthenticatedRouteContext = () => {
	const { auth } = useRouteContext({
		from: "__root__",
	});

	if (!auth.isAuthenticated) {
		throw new Error("Authenticated route context is unavailable");
	}

	return {
		auth,
	};
};
