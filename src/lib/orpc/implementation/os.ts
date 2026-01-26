import type { LoggerContext } from "@orpc/experimental-pino";
import { implement } from "@orpc/server";
import type { RequestHeadersPluginContext } from "@orpc/server/plugins";
import { contracts } from "@/lib/orpc/contracts";

interface ORPCContext extends LoggerContext, RequestHeadersPluginContext {
	meta?: { zedToken?: string };
}

export const os = implement(contracts).$context<ORPCContext>();
