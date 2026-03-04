import { implement } from "@orpc/server";
import type { RequestHeadersPluginContext } from "@orpc/server/plugins";
import { contracts } from "@/lib/orpc/contracts";

interface ORPCContext extends RequestHeadersPluginContext {
	meta?: {
		zedToken?: string;
	};
}

export const os = implement(contracts).$context<ORPCContext>();
