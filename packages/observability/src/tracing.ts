import * as OtelTracer from "@effect/opentelemetry/OtelTracer";
import { trace } from "@opentelemetry/api";
import type * as Effect from "effect/Effect";

/** Parents the effect's spans and logs under the caller's active OpenTelemetry span. */
export const withActiveSpan = <A, E, R>(
	effect: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> => {
	const span = trace.getActiveSpan();
	return span === undefined
		? effect
		: OtelTracer.withSpanContext(effect, span.spanContext());
};
