import { makeObservabilityLayer } from "@orcai/observability";
import { ORPCInstrumentation } from "@orpc/opentelemetry";
import packageJson from "../../../../package.json" with { type: "json" };

export const ObservabilityLive = makeObservabilityLayer({
	serviceName: "orcai-app",
	serviceVersion: packageJson.version,
	additionalInstrumentations: [
		new ORPCInstrumentation(),
	],
});
