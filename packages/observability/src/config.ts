export const isOtelEnabled = (): boolean => {
	const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim();
	return endpoint !== undefined && endpoint.length > 0;
};
