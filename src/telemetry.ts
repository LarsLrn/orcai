// Centralized OpenTelemetry initialization.
// Ensures the NodeSDK (and instrumentations) are started exactly once.
// Export a helper to lazily (or eagerly) start telemetry without per-request cost.

import { SpanStatusCode, trace } from "@opentelemetry/api";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { ORPCInstrumentation } from "@orpc/otel";

let startPromise: Promise<void> | null = null;
let started = false;
let shuttingDown = false;

const sdk = new NodeSDK({
	instrumentations: [new ORPCInstrumentation()],
	// Add resource / exporter config here (or via environment variables)
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

async function internalStart() {
	if (started || shuttingDown) return;
	await sdk.start();
	started = true;

	const graceful = () => {
		if (shuttingDown) return;
		shuttingDown = true;
		sdk
			.shutdown()
			.catch(() => {
				// ignore errors during shutdown
			})
			.finally(() => {
				// eslint-disable-next-line no-process-exit
				process.exit(0);
			});
	};

	process.once("SIGINT", graceful);
	process.once("SIGTERM", graceful);
}

export function ensureTelemetryStarted(): Promise<void> {
	if (!startPromise) {
		startPromise = internalStart();
	}
	return startPromise;
}

export async function shutdownTelemetry() {
	if (!started || shuttingDown) return;
	shuttingDown = true;
	await sdk.shutdown().catch(() => {
		// ignore errors during explicit shutdown
	});
}
