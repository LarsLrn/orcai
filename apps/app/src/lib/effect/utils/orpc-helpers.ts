import * as OtelTracer from "@effect/opentelemetry/OtelTracer";
import { context as otelContext, trace } from "@opentelemetry/api";
import { logErrorCause } from "@orcai/observability";
import { runPromise, type WithEffectContext } from "@orpc/experimental-effect";
import type { AnyProcedure } from "@orpc/server";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import { unknownToORPCError } from "@/lib/orpc/implementation/error-mapping";

export async function runMiddlewareEffect<A, E, R>(
	opts: {
		context: object;
		path: string[];
		procedure: AnyProcedure;
		signal?: AbortSignal;
	},
	effect: Effect.Effect<A, E, R>,
): Promise<A> {
	const effectContext = (opts.context as WithEffectContext<R>)[
		"effect/context"
	];
	const provided = effect.pipe(Effect.provide(effectContext));
	const activeSpan = trace.getSpan(otelContext.active());

	const traced =
		activeSpan === undefined
			? provided
			: OtelTracer.withSpanContext(provided, activeSpan.spanContext());
	const logged = traced.pipe(
		Effect.tapCause((cause) =>
			Cause.hasInterruptsOnly(cause)
				? Effect.void
				: logErrorCause("ORPC middleware effect failed", cause),
		),
	);

	try {
		return await runPromise(logged, {
			signal: opts.signal,
		});
	} catch (error) {
		throw unknownToORPCError(error);
	}
}
