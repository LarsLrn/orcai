import { contracts } from "@orcai/contracts";
import { implement } from "@orpc/server";
import type { RequestHeadersHandlerPluginContext } from "@orpc/server/plugins";

interface ORPCContext extends RequestHeadersHandlerPluginContext {
	meta?: {
		zedToken?: string;
	};
}

export const os = implement(contracts).$context<ORPCContext>();
