import "@orpc/effect/extensions/effect";

import { contracts } from "@orcai/contracts";
import type { WithEffectContext } from "@orpc/effect";
import { implement } from "@orpc/server";
import type {
	RequestHeadersHandlerPluginContext,
	ResponseHeadersHandlerPluginContext,
} from "@orpc/server/plugins";
import type { AppRuntimeContext } from "@/lib/effect/runtime";
import { zedTokenResponseMiddleware } from "@/lib/orpc/middlewares/zed-token";

/** The Effect services every procedure and middleware runs with. */
export type AppEffectContext = WithEffectContext<AppRuntimeContext>;

export interface ORPCContext
	extends RequestHeadersHandlerPluginContext,
		ResponseHeadersHandlerPluginContext,
		AppEffectContext {
	meta?: {
		zedToken?: string;
		/** The newest token of the assistant turn that makes the call. */
		turnZedToken?: string;
		/** Keeps what the assistant turn that makes the call wrote. */
		turnWrites?: {
			record: (
				path: readonly string[],
				input: unknown,
				output: unknown,
			) => void;
		};
	};
	secureCookies: boolean;
}

export const os = implement(contracts)
	.$context<ORPCContext>()
	.use(zedTokenResponseMiddleware);
