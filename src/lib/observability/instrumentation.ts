import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { PinoInstrumentation } from "@opentelemetry/instrumentation-pino";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { ORPCInstrumentation } from "@orpc/otel";
import { otelResource } from "./resource-config";

const globalForOtel = globalThis as {
	__OTEL_SDK_INSTANCE__?: NodeSDK;
	__OTEL_SHUTDOWN_REGISTERED__?: boolean;
};

/**
 * Get the singleton OTEL SDK instance.
 * In development, utilizes a global variable to persist the connection across HMR reloads.
 */
export function initOtel(): void {
	if (globalForOtel.__OTEL_SDK_INSTANCE__) return;

	const sdk = new NodeSDK({
		resource: otelResource,
		instrumentations: [
			getNodeAutoInstrumentations(),
			new ORPCInstrumentation(),
			new PinoInstrumentation(),
		],
	});

	try {
		sdk.start();
		globalForOtel.__OTEL_SDK_INSTANCE__ = sdk;
		registerShutdownOnce();
	} catch (err) {
		console.error("Failed to start Otel SDK:", err);
	}
}

function registerShutdownOnce() {
	if (globalForOtel.__OTEL_SHUTDOWN_REGISTERED__) return;
	globalForOtel.__OTEL_SHUTDOWN_REGISTERED__ = true;

	process.once("SIGTERM", shutdownOtel);
	process.once("SIGINT", shutdownOtel);
}

function shutdownOtel() {
	const sdk = globalForOtel.__OTEL_SDK_INSTANCE__;
	if (!sdk) return;

	globalForOtel.__OTEL_SDK_INSTANCE__ = undefined;

	sdk
		.shutdown()
		.then(() => console.log("Otel SDK shut down successfully"))
		.catch((error) => console.error("Error shutting down Otel SDK", error));
}
