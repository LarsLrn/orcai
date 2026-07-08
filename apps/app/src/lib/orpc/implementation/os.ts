import "@orpc/experimental-effect/extensions/effect";

import { contracts } from "@orcai/contracts";
import type { WithEffectContext } from "@orpc/experimental-effect";
import { implement } from "@orpc/server";
import type { RequestHeadersHandlerPluginContext } from "@orpc/server/plugins";
import type { AppRuntimeContext } from "@/lib/effect/runtime";

export interface ORPCContext
	extends RequestHeadersHandlerPluginContext,
		WithEffectContext<AppRuntimeContext> {
	meta?: {
		zedToken?: string;
	};
}

export const os = implement(contracts).$context<ORPCContext>();
