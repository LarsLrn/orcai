// Centralized OpenTelemetry initialization.
// Ensures the NodeSDK (and instrumentations) are started exactly once.
// Following OpenTelemetry best practices for Node.js applications.

import { SpanStatusCode, trace } from "@opentelemetry/api";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { ORPCInstrumentation } from "@orpc/otel";

let started = false;
let shuttingDown = false;

const sdk = new NodeSDK({
	// Resource will be auto-detected from environment variables:
	// OTEL_SERVICE_NAME, OTEL_SERVICE_VERSION, etc.
	autoDetectResources: true,
	instrumentations: [
		// Add your custom instrumentations
		new ORPCInstrumentation(),
		// Auto-instrumentations will be added automatically based on detected modules
	],
	// Exporters and other config can be set via environment variables:
	// OTEL_EXPORTER_OTLP_ENDPOINT, OTEL_TRACES_EXPORTER, OTEL_METRICS_EXPORTER, etc.
});

// --- Uncaught / unhandled error capturing ----------------------------------
// Attach these listeners immediately so we don't miss early errors. They will
// be no-ops until the SDK starts, but that's acceptable.
const uncaughtTracer = trace.getTracer("uncaught-errors");

function recordUncaught(eventName: string, reason: unknown) {
	try {
		const span = uncaughtTracer.startSpan(eventName);
		const message = String(
			reason instanceof Error && reason.message ? reason.message : reason,
		);
		if (reason instanceof Error) {
			span.recordException(reason);
		} else {
			span.recordException({ message });
		}
		span.setStatus({ code: SpanStatusCode.ERROR, message });
		span.end();
	} catch {
		// Best effort only; never throw from a global handler
	}
}

process.on("uncaughtException", (err) =>
	recordUncaught("uncaughtException", err),
);
process.on("unhandledRejection", (reason) =>
	recordUncaught("unhandledRejection", reason),
);

export function startTelemetry() {
	if (started || shuttingDown) return;

	// Start the SDK - this registers global providers
	sdk.start();
	started = true;

	// Set up graceful shutdown handlers
	const gracefulShutdown = () => {
		if (shuttingDown) return;
		shuttingDown = true;

		sdk
			.shutdown()
			.catch((error) => {
				console.error("Error during OpenTelemetry shutdown:", error);
			})
			.finally(() => {
				process.exit(0);
			});
	};

	// Handle various shutdown signals
	process.once("SIGINT", gracefulShutdown);
	process.once("SIGTERM", gracefulShutdown);
	process.once("SIGQUIT", gracefulShutdown);
}
