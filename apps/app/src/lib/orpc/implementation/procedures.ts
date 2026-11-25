import type { contracts } from "@orcai/contracts";
import type { ContractRouterClient } from "@orpc/contract";
import type { EffectClient } from "@orpc/effect";
import * as Context from "effect/Context";
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
