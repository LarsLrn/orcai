import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { NodeSDK } from "@opentelemetry/sdk-node";
import {
	ATTR_SERVICE_NAME,
	ATTR_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";
import { ORPCInstrumentation } from "@orpc/otel";

const sdk = new NodeSDK({
	resource: resourceFromAttributes({
		[ATTR_SERVICE_NAME]: "tanstack",
		[ATTR_SERVICE_VERSION]: "0.2.0",
	}),
	instrumentations: [getNodeAutoInstrumentations(), new ORPCInstrumentation()],
});

sdk.start();
