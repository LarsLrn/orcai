import { createORPCClient } from "@orpc/client";
import type { RouterClient } from "@orpc/server";
import { queryUtils } from "@/lib/orpc/query-utils";
import type { router } from "@/lib/orpc/router";

type AppClient = RouterClient<typeof router>;

type Script<T> = T extends (...rest: infer Rest) => PromiseLike<infer Output>
	? (input: Rest[0]) => Output | Promise<Output>
	: {
			[Key in keyof T]?: Script<T[Key]>;
		};

/** The procedures a test answers, keyed like the router. */
export type ScriptedServer = Script<AppClient>;

const handlerAt = (server: ScriptedServer, path: readonly string[]) =>
	path.reduce<unknown>(
		(node, key) =>
			typeof node === "object" && node !== null
				? (node as Record<string, unknown>)[key]
				: undefined,
		server,
	);

/**
 * `@/lib/orpc/orpc` for unit tests: the app's query utilities over a transport
 * that answers from `server`. A procedure the test did not script fails.
 */
export const scriptedOrpc = (server: ScriptedServer = {}) => {
	const client = createORPCClient<AppClient>({
		call: (path, input) => {
			const handler = handlerAt(server, path);
			return typeof handler === "function"
				? new Promise((resolve) => resolve(handler(input)))
				: Promise.reject(
						new Error(`${path.join(".")} is not scripted in this test`),
					);
		},
	});

	return {
		client,
		orpc: queryUtils(client),
	};
};

/** What answers one procedure, to type a `mock()` that stands in for it. */
export type ScriptedProcedure<
	Namespace extends keyof AppClient,
	Procedure extends keyof AppClient[Namespace],
> = AppClient[Namespace][Procedure] extends (
	...rest: infer Rest
) => PromiseLike<infer Output>
	? (input: Rest[0]) => Promise<Output>
	: never;
