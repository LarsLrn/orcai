import { Effect } from "effect";
import { runtime } from "@/lib/effect/runtime";
import { ObservabilityLive } from "@/lib/effect/services/observability";
import type { ORPCContext } from "./os";

export async function createORPCContext(params: {
	reqHeaders: Headers;
	zedToken?: string;
}): Promise<ORPCContext> {
	return {
		reqHeaders: params.reqHeaders,
		meta: {
			zedToken: params.zedToken,
		},
		"effect/context": await runtime.context(),
		"effect/wrap": (effect) => effect.pipe(Effect.provide(ObservabilityLive)),
	};
}
