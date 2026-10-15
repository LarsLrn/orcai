import { OpenTelemetry } from "@ai-sdk/otel";
import { registerTelemetry, type TelemetryOptions } from "ai";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

/** Sends AI SDK spans to the globally registered tracer provider. */
export const AiTelemetryLive = Layer.effectDiscard(
	Effect.sync(() =>
		registerTelemetry(
			new OpenTelemetry({
				runtimeContext: true,
			}),
		),
	),
);

/**
 * Settings that trace an AI SDK call with its token usage but without prompt or
 * response content. The ids travel as runtime context and become span attributes.
 */
export const aiTelemetry = (
	functionId: string,
	ids: Record<string, string> = {},
) => {
	const runtimeContext: Record<string, unknown> = ids;
	const telemetry = {
		isEnabled: true,
		recordInputs: false,
		recordOutputs: false,
		functionId,
		includeRuntimeContext: Object.fromEntries(
			Object.keys(ids).map((key) => [
				key,
				true,
			]),
		),
	} satisfies TelemetryOptions;

	return {
		runtimeContext,
		telemetry,
	};
};
