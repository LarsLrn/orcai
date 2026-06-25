import * as OtelTracer from "@effect/opentelemetry/Tracer";
import { context as otelContext, trace } from "@opentelemetry/api";
import { runtime } from "@/lib/effect/runtime";
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
		"effect/wrap": (effect) => {
			const activeSpan = trace.getSpan(otelContext.active());

			return activeSpan
				? OtelTracer.withSpanContext(effect, activeSpan.spanContext())
				: effect;
		},
	};
}
