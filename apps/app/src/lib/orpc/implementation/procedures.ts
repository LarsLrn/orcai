import type { contracts } from "@orcai/contracts";
import { createEffectClient } from "@orpc/experimental-effect";
import {
	type AnyRouter,
	type ContractedRouter,
	createRouterClient,
	type InferRouterInitialContext,
} from "@orpc/server";

type Contracts = typeof contracts;

/** Procedures of a contract namespace; some contracts have procedures the server leaves out. */
type NamespaceRouter<K extends keyof Contracts, T> = AnyRouter &
	Partial<ContractedRouter<Contracts[K], any>> &
	Record<Exclude<keyof T, keyof Contracts[K]>, never>;

/** Calls a namespace's procedures as effects in the caller's context, so middlewares and validation still apply. */
export const createProcedures = <
	K extends keyof Contracts,
	T extends NamespaceRouter<K, T>,
>(
	namespace: K,
	router: T,
) =>
	createEffectClient(
		createRouterClient(router, {
			path: [
				namespace,
			],
			context: (context: InferRouterInitialContext<T>) => context,
		}),
	);
