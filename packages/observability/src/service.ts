import * as NodeSdk from "@effect/opentelemetry/NodeSdk";
import * as OtelTracer from "@effect/opentelemetry/OtelTracer";
import * as Resource from "@effect/opentelemetry/Resource";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import type { Instrumentation } from "@opentelemetry/instrumentation";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Logger from "effect/Logger";
import { isOtelEnabled } from "./config";

const PrettyLoggerLive =
	process.env.NODE_ENV === "development"
		? Logger.layer([
				Logger.consolePretty(),
			])
		: Layer.empty;

type RegisterableTracerProvider = {
	register(): void;
};

export const makeObservabilityLayer = (config: {
	serviceName: string;
	serviceVersion: string;
	additionalInstrumentations?: Instrumentation[];
}) => {
	const ResourceLive = Resource.layer({
		serviceName: config.serviceName,
		serviceVersion: config.serviceVersion,
	});

	if (!isOtelEnabled()) {
		return Layer.mergeAll(ResourceLive, PrettyLoggerLive);
	}

	const LogLive = NodeSdk.layer(() => ({
		resource: {
			serviceName: config.serviceName,
			serviceVersion: config.serviceVersion,
		},
		logRecordProcessor: new BatchLogRecordProcessor({
			exporter: new OTLPLogExporter(),
		}),
	}));

	const TracerProviderLive = NodeSdk.layerTracerProvider(
		new BatchSpanProcessor(new OTLPTraceExporter()),
	);

	const RegisterGlobalTracerProviderLive = Layer.effectDiscard(
		Effect.gen(function* () {
			const tracerProvider = yield* OtelTracer.OtelTracerProvider;

			// Effect's Node tracer provider is local to the layer until registered.
			// ORPC reads the global OpenTelemetry API, so it needs the same provider there.
			yield* Effect.sync(() =>
				(tracerProvider as unknown as RegisterableTracerProvider).register(),
			);
		}),
	);

	const AutoInstrumentationLive = Layer.effectDiscard(
		Effect.acquireRelease(
			Effect.gen(function* () {
				const tracerProvider = yield* OtelTracer.OtelTracerProvider;

				return yield* Effect.sync(() =>
					registerInstrumentations({
						tracerProvider,
						instrumentations: [
							getNodeAutoInstrumentations(),
							...(config.additionalInstrumentations ?? []),
						],
					}),
				);
			}),
			(unregister) => Effect.sync(unregister),
		),
	);

	const TracerLive = Layer.mergeAll(
		OtelTracer.layer,
		RegisterGlobalTracerProviderLive,
		AutoInstrumentationLive,
	).pipe(Layer.provide(TracerProviderLive));

	return Layer.mergeAll(LogLive, TracerLive).pipe(
		Layer.provideMerge(ResourceLive),
	);
};
