/** Helper function to set a stable name for ORPC middlewares as that is used in OTEL tracing */
// biome-ignore lint/complexity/noBannedTypes: <Just a wrapper function>
export function withName<T extends Function>(fn: T, name: string): T {
	Object.defineProperty(fn, "name", {
		value: name,
	});
	return fn;
}
