import { makeObservabilityLayer } from "@orcai/observability";
import { ORPCInstrumentation } from "@orpc/otel";

export const ObservabilityLive = makeObservabilityLayer({
	serviceName: "orcai-app",
	serviceVersion: "0.2.0",
	additionalInstrumentations: [
		new ORPCInstrumentation(),
	],
});
