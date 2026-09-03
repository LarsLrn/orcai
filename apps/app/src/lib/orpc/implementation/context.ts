import * as OtelTracer from "@effect/opentelemetry/OtelTracer";
import { context as otelContext, trace } from "@opentelemetry/api";
import { logErrorCause } from "@orcai/observability";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import { runtime } from "@/lib/effect/runtime";
import { causeToORPCError } from "./error-mapping";
import type { ORPCContext } from "./os";

function mapEffectCauseToORPCError<A, E>(
	effect: Effect.Effect<A, E>,
): Effect.Effect<A, E> {
	const mapped = (effect as Effect.Effect<A, unknown>).pipe(
		Effect.catchCause((cause: Cause.Cause<unknown>) => {
			if (Cause.hasInterruptsOnly(cause)) {
				return Effect.failCause(cause);
			}

			return logErrorCause("ORPC effect failed", cause).pipe(
				Effect.andThen(Effect.fail(causeToORPCError(cause))),
			);
		}),
	);

	return mapped as unknown as Effect.Effect<A, E>;
}

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

			const traced = activeSpan
				? OtelTracer.withSpanContext(effect, activeSpan.spanContext())
				: effect;

			return mapEffectCauseToORPCError(traced);
		},
	};
}
