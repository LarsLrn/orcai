import { makeObservabilityLayer } from "@orcai/observability";
import packageJson from "../package.json" with { type: "json" };

export const ObservabilityLive = makeObservabilityLayer({
	serviceName: "orcai-workers",
	serviceVersion: packageJson.version,
});
