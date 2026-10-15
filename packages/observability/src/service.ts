import * as NodeSdk from "@effect/opentelemetry/NodeSdk";
import * as OtelTracer from "@effect/opentelemetry/OtelTracer";
import * as Resource from "@effect/opentelemetry/Resource";
import { context, metrics, propagation, trace } from "@opentelemetry/api";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import {
	type Instrumentation,
	registerInstrumentations,
} from "@opentelemetry/instrumentation";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import {
	BatchLogRecordProcessor,
	type LogRecordProcessor,
} from "@opentelemetry/sdk-logs";
import {
	MeterProvider,
	type MetricReader,
	PeriodicExportingMetricReader,
} from "@opentelemetry/sdk-metrics";
import {
	BatchSpanProcessor,
	type SpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import * as Context from "effect/Context";
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

type ServiceConfig = {
	serviceName: string;
	serviceVersion: string;
};

class OtelMeterProvider extends Context.Service<
	OtelMeterProvider,
	MeterProvider
>()("@orcai/observability/OtelMeterProvider") {}

// Installs the tracer provider with the global context manager and propagator.
const GlobalTracerProviderLive = Layer.effectDiscard(
	Effect.acquireRelease(
		Effect.gen(function* () {
			const provider = yield* OtelTracer.OtelTracerProvider;
			if (provider instanceof NodeTracerProvider) provider.register();
		}),
		() =>
			Effect.sync(() => {
				trace.disable();
				context.disable();
				propagation.disable();
			}),
	),
);

const makeMeterProviderLayer = (metricReader: MetricReader) =>
	Layer.effect(
		OtelMeterProvider,
		Effect.gen(function* () {
			const resource = yield* Resource.Resource;
			return yield* Effect.acquireRelease(
				Effect.sync(() => {
					const provider = new MeterProvider({
						resource,
						readers: [
							metricReader,
						],
					});
					metrics.setGlobalMeterProvider(provider);
					return provider;
				}),
				(provider) =>
					Effect.promise(() => {
						metrics.disable();
						return provider.shutdown();
					}).pipe(
						Effect.ignore,
						Effect.interruptible,
						Effect.timeoutOption("3 seconds"),
					),
			);
		}),
	);

const makeInstrumentationsLayer = (instrumentations: Instrumentation[]) =>
	Layer.effectDiscard(
		Effect.acquireRelease(
			Effect.gen(function* () {
				const tracerProvider = yield* OtelTracer.OtelTracerProvider;
				const meterProvider = yield* OtelMeterProvider;
				return registerInstrumentations({
					tracerProvider,
					meterProvider,
					instrumentations,
				});
			}),
			(unregister) => Effect.sync(unregister),
		),
	);

const makeSdkLayer = (
	config: ServiceConfig & {
		logRecordProcessor?: LogRecordProcessor;
	},
) =>
	NodeSdk.layer(() => ({
		resource: {
			serviceName: config.serviceName,
			serviceVersion: config.serviceVersion,
		},
		logRecordProcessor: config.logRecordProcessor,
	}));

/** Traces, logs and metrics sharing one resource, with global tracer and meter providers. */
export const makeLayer = (
	config: ServiceConfig & {
		spanProcessor: SpanProcessor;
		logRecordProcessor: LogRecordProcessor;
		metricReader: MetricReader;
		instrumentations?: Instrumentation[];
	},
) =>
	Layer.mergeAll(
		OtelTracer.layer,
		GlobalTracerProviderLive,
		makeInstrumentationsLayer(config.instrumentations ?? []),
	).pipe(
		Layer.provide(
			Layer.mergeAll(
				NodeSdk.layerTracerProvider(config.spanProcessor),
				makeMeterProviderLayer(config.metricReader),
			),
		),
		Layer.provideMerge(makeSdkLayer(config)),
	);

export const makeObservabilityLayer = (
	config: ServiceConfig & {
		additionalInstrumentations?: Instrumentation[];
	},
) => {
	if (!isOtelEnabled()) {
		return Layer.mergeAll(makeSdkLayer(config), PrettyLoggerLive);
	}

	return makeLayer({
		serviceName: config.serviceName,
		serviceVersion: config.serviceVersion,
		spanProcessor: new BatchSpanProcessor(new OTLPTraceExporter()),
		logRecordProcessor: new BatchLogRecordProcessor({
			exporter: new OTLPLogExporter(),
		}),
		metricReader: new PeriodicExportingMetricReader({
			exporter: new OTLPMetricExporter(),
			exportIntervalMillis: 60_000,
		}),
		instrumentations: [
			// Bun serves HTTP without node:http, so only client requests are traced.
			new HttpInstrumentation({
				disableIncomingRequestInstrumentation: true,
			}),
			...(config.additionalInstrumentations ?? []),
		],
	});
};
