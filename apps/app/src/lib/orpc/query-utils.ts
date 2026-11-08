import type { RouterClient } from "@orpc/server";
import {
	createTanstackQueryUtils,
	type RouterUtils,
} from "@orpc/tanstack-query";
import { queryDefaults } from "./query-defaults";
import type { router } from "./router";
import { invalidateStaleQueries } from "./stale-queries";

type AppClient = RouterClient<typeof router>;

/** The app's query utilities over `client`, with its defaults and invalidation. */
export const queryUtils = (client: AppClient): RouterUtils<AppClient> => {
	const orpc: RouterUtils<AppClient> = createTanstackQueryUtils(client, {
		scoped: queryDefaults,
		mutationInterceptors: [
			invalidateStaleQueries(() => orpc),
		],
	});
	return orpc;
};
