import { makeObservabilityLayer } from "@orcai/observability";

export const ObservabilityLive = makeObservabilityLayer({
	serviceName: "orcai-workers",
	serviceVersion: "0.1.0",
});
