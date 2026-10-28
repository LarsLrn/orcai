const otlpEndpoint = () => process.env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim();

export const isOtelEnabled = (): boolean => {
	const endpoint = otlpEndpoint();
	return endpoint !== undefined && endpoint.length > 0;
};

/** The exporter's host, without path or credentials; undefined when export is off. */
export const otlpEndpointHost = (): string | undefined => {
	const endpoint = otlpEndpoint();
	return endpoint ? (URL.parse(endpoint)?.host ?? undefined) : undefined;
};
