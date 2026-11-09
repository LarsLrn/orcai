import type { ContractClient } from "@orcai/contracts";
import { SpiceDbLive, type SpiceDbService } from "@orcai/spice-db";
import {
	headZedToken,
	type ZedTokenKeeper,
	zedTokenKeeper,
} from "@orcai/spice-db/testing";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import * as ManagedRuntime from "effect/ManagedRuntime";

export type ApiClient = ContractClient;

/** Mirrors `HEADERS.X_ZED_TOKEN` and `COOKIES.ZED_TOKEN.name` of the app. */
export const ZED_TOKEN_HEADER = "X-Zed-Token";
export const ZED_TOKEN_COOKIE = "zed_token";

/** The newest zedToken a set of clients has seen in a response. */
export type ZedTokenStore = ZedTokenKeeper;

let spiceDb: ManagedRuntime.ManagedRuntime<SpiceDbService, unknown> | undefined;

/** A head-revision token from the stack's SpiceDB, for writes that return out of order. */
const head = () => {
	spiceDb ??= ManagedRuntime.make(SpiceDbLive);
	return spiceDb.runPromise(headZedToken);
};

export const createZedTokenStore = (): ZedTokenStore => zedTokenKeeper(head);

const storesByClient = new WeakMap<object, ZedTokenStore>();

/** The newest zedToken this client has seen, for seeding a browser context. */
export const zedTokenOf = (client: ApiClient): string | undefined =>
	storesByClient.get(client)?.read();

const zedTokenIn = (output: unknown): string | undefined => {
	if (output === null || typeof output !== "object") return undefined;

	const meta = (
		output as {
			meta?: unknown;
		}
	).meta;

	if (meta === null || typeof meta !== "object") return undefined;

	const zedToken = (
		meta as {
			zedToken?: unknown;
		}
	).zedToken;

	return typeof zedToken === "string" ? zedToken : undefined;
};

/**
 * A typed oRPC client for `/api/rpc`, acting as the session behind
 * `cookieHeader`. The client remembers the `meta.zedToken` of every response
 * and sends it back, so its later reads are at least as fresh as its writes.
 * Pass a shared `store` to give several clients one memory.
 */
export const createApiClient = (
	baseURL: string,
	cookieHeader?: string,
	store: ZedTokenStore = createZedTokenStore(),
): ApiClient => {
	const link = new RPCLink({
		origin: baseURL,
		url: "/api/rpc",
		headers: () => {
			const zedToken = store.read();

			return {
				...(cookieHeader
					? {
							cookie: cookieHeader,
						}
					: {}),
				...(zedToken
					? {
							[ZED_TOKEN_HEADER]: zedToken,
						}
					: {}),
			};
		},
		interceptors: [
			({ next }) => store.track(next, zedTokenIn),
		],
	});

	const client: ApiClient = createORPCClient(link);
	storesByClient.set(client, store);

	return client;
};
