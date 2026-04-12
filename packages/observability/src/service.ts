import * as NodeSdk from "@effect/opentelemetry/NodeSdk";
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
		? Logger.replace(Logger.defaultLogger, Logger.prettyLoggerDefault)
		: Layer.empty;

export const makeObservabilityLayer = (config: {
	serviceName: string;
	serviceVersion: string;
	additionalInstrumentations?: Instrumentation[];
}): Layer.Layer<Resource.Resource> => {
	const ResourceLive = Resource.layer({
		serviceName: config.serviceName,
		serviceVersion: config.serviceVersion,
	});

	if (!isOtelEnabled()) {
		return Layer.provideMerge(PrettyLoggerLive, ResourceLive);
	}

	const NodeSdkLive = NodeSdk.layer(() => ({
		resource: {
			serviceName: config.serviceName,
			serviceVersion: config.serviceVersion,
		},
		spanProcessor: new BatchSpanProcessor(new OTLPTraceExporter()),
		logRecordProcessor: new BatchLogRecordProcessor(new OTLPLogExporter()),
	}));

	const AutoInstrumentationLive = Layer.scopedDiscard(
		Effect.acquireRelease(
			Effect.sync(() =>
				registerInstrumentations({
					instrumentations: [
						getNodeAutoInstrumentations(),
						...(config.additionalInstrumentations ?? []),
					],
				}),
			),
			(unregister) => Effect.sync(unregister),
		),
	);

	return Layer.mergeAll(NodeSdkLive, AutoInstrumentationLive);
};
