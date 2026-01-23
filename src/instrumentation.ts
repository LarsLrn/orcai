import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { NodeSDK } from "@opentelemetry/sdk-node";
import {
	ATTR_SERVICE_NAME,
	ATTR_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";
import { ORPCInstrumentation } from "@orpc/otel";

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
		resource: resourceFromAttributes({
			[ATTR_SERVICE_NAME]: "tanstack",
			[ATTR_SERVICE_VERSION]: "0.2.0",
		}),
		instrumentations: [
			getNodeAutoInstrumentations(),
			new ORPCInstrumentation(),
		],
	});

	try {
		sdk.start();
		globalForOtel.__OTEL_SDK_INSTANCE__ = sdk;
		registerShutdownOnce();
	} catch (err) {
		console.error("Failed to start OTEL SDK:", err);
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

	try {
		sdk
			.shutdown()
			.catch((err) => console.error("Error shutting down OTEL SDK:", err));
	} catch (err) {
		console.error("Error initiating OTEL SDK shutdown:", err);
	}
}
