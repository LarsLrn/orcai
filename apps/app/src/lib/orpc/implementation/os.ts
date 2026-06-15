import { contracts } from "@orcai/contracts";
import { implement } from "@orpc/server";
import type { RequestHeadersPluginContext } from "@orpc/server/plugins";

interface ORPCContext extends RequestHeadersPluginContext {
	meta?: {
		zedToken?: string;
	};
}

export const os = implement(contracts).$context<ORPCContext>();
