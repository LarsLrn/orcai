import type { contracts } from "@orcai/contracts";
import type { ContractRouterClient } from "@orpc/contract";
import { createEffectClient, type EffectClient } from "@orpc/effect";
import { createRouterClient } from "@orpc/server";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import type { ORPCContext } from "./os";

/**
 * Every procedure as an effect, called in the caller's context so middlewares
 * and validation still apply. Typed from the contracts: the router's own type
 * depends on code that calls procedures.
 */
export type ProcedureClients = EffectClient<
	ContractRouterClient<typeof contracts, ORPCContext>
>;

export class Procedures extends Context.Service<Procedures, ProcedureClients>()(
	"Procedures",
) {}

// The router imports code that calls procedures, so it loads when the layer builds.
export const ProceduresLive: Layer.Layer<Procedures> = Layer.effect(
	Procedures,
	Effect.promise(() => import("@/lib/orpc/router")).pipe(
		Effect.map(({ router }) =>
			createEffectClient(
				createRouterClient(router, {
					context: (context: ORPCContext) => context,
				}),
			),
		),
	),
);
