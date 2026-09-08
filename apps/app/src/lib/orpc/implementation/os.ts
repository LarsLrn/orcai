import "@orpc/experimental-effect/extensions/effect";

import { contracts } from "@orcai/contracts";
import type { WithEffectContext } from "@orpc/experimental-effect";
import { implement } from "@orpc/server";
import type {
	RequestHeadersHandlerPluginContext,
	ResponseHeadersHandlerPluginContext,
} from "@orpc/server/plugins";
import type { AppRuntimeContext } from "@/lib/effect/runtime";
import { zedTokenResponseMiddleware } from "@/lib/orpc/middlewares/zed-token";

export interface ORPCContext
	extends RequestHeadersHandlerPluginContext,
		ResponseHeadersHandlerPluginContext,
		WithEffectContext<AppRuntimeContext> {
	meta?: {
		zedToken?: string;
	};
	secureCookies: boolean;
}

export const os = implement(contracts)
	.$context<ORPCContext>()
	.use(zedTokenResponseMiddleware);
