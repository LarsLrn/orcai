import { trace } from "@opentelemetry/api";
import pino from "pino";
import { otelResource } from "./resource-config";

const getPinoTargets = (): pino.TransportTargetOptions[] => {
	const pinoTargets: pino.TransportTargetOptions[] = [
		{
			target: "pino-opentelemetry-transport",
			options: {
				resourceAttributes: otelResource.attributes,
			},
			level: process.env.LOG_LEVEL || "info",
		},
	];

	if (process.env.NODE_ENV === "development") {
		pinoTargets.push({
			target: "pino-pretty",
			options: { colorize: true },
			level: process.env.LOG_LEVEL || "info",
		});
	}

	return pinoTargets;
};

export const logger = pino(
	{
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
	},
	pino.transport({
		targets: getPinoTargets(),
	}),
);
