import { trace } from "@opentelemetry/api";
import pino from "pino";
import { otelResource } from "./resource-config";

const shouldEnableOtelLogTransport = (): boolean =>
	Boolean(process.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT);

const getTransportTargets = (): pino.TransportTargetOptions[] => {
	const level = process.env.LOG_LEVEL || "info";
	const targets: pino.TransportTargetOptions[] = [];
	const otelEnabled = shouldEnableOtelLogTransport();

	if (process.env.NODE_ENV === "development") {
		targets.push({
			target: "pino-pretty",
			options: {
				colorize: true,
			},
			level,
		});
	}

	// When OTEL logs are enabled in non-dev, use explicit stdout transport so
	// logs fan out to both stdout and OTEL in one transport pipeline.
	if (process.env.NODE_ENV !== "development" && otelEnabled) {
		targets.push({
			target: "pino/file",
			options: {
				destination: 1,
			},
			level,
		});
	}

	if (otelEnabled) {
		targets.push({
			target: "pino-opentelemetry-transport",
			options: {
				resourceAttributes: otelResource.attributes,
			},
			level,
		});
	}

	return targets;
};

const loggerOptions: pino.LoggerOptions = {
	level: process.env.LOG_LEVEL || "info",
	mixin() {
		const span = trace.getActiveSpan();
		if (!span) return {};

		const { traceId, spanId, traceFlags } = span.spanContext();
		if (!traceId || !spanId) return {};

		return {
			trace_id: traceId,
			span_id: spanId,
			trace_flags: traceFlags,
		};
	},
};

const transportTargets = getTransportTargets();

export const logger =
	transportTargets.length === 0
		? pino(loggerOptions)
		: pino(
				loggerOptions,
				pino.transport({
					targets: transportTargets,
				}),
			);
