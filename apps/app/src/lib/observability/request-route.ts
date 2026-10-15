import { METHODS } from "node:http";
import { contracts } from "@orcai/contracts";
import { walkProcedureContractsSync } from "@orpc/server";
import type { AnyRouter } from "@tanstack/react-router";

const AUTH_ROUTE = "/api/auth/$";
const RPC_ROUTE = "/api/rpc/$";
const RPC_PREFIX = "/api/rpc/";
const UNMATCHED_ROUTE = "(unmatched)";

const HTTP_METHODS = new Set(METHODS);

const procedurePaths = new Set<string>();
walkProcedureContractsSync(contracts, (_, path) => {
	procedurePaths.add(path.join("/"));
});

type RouteMatcher = Pick<AnyRouter, "getMatchedRoutes">;

/**
 * The route template a request resolves to. RPC calls append the procedure path
 * when it names a procedure; other splat routes keep their template because their
 * sub-paths can carry tokens.
 */
export const resolveRequestRoute = (
	router: RouteMatcher,
	pathname: string,
): string | undefined => {
	const [, , route] = router.getMatchedRoutes(pathname);

	if (route?.fullPath === RPC_ROUTE) {
		const procedurePath = pathname.slice(RPC_PREFIX.length);
		if (procedurePaths.has(procedurePath)) return RPC_PREFIX + procedurePath;
	}

	return route?.fullPath;
};

/** The request path for span attributes; auth paths can carry tokens. */
export const loggablePath = (route: string | undefined, pathname: string) =>
	route === AUTH_ROUTE ? undefined : pathname;

export const normaliseHttpMethod = (method: string) =>
	HTTP_METHODS.has(method) ? method : "_OTHER";

export const requestSpanName = (method: string, route: string | undefined) =>
	`${normaliseHttpMethod(method)} ${route ?? UNMATCHED_ROUTE}`;
