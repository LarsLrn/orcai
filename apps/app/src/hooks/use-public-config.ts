import { rootRouteId, useLoaderData } from "@tanstack/react-router";

/** The deployment values the server hands the browser. */
export const usePublicConfig = () =>
	useLoaderData({
		from: rootRouteId,
	});
