import { makeObservabilityLayer } from "@orcai/observability";
import { ORPCInstrumentation } from "@orpc/opentelemetry";
import {
	getTracer,
	setTracer,
	type Tracer,
	type TracingAttributeValue,
	type TracingException,
	type TracingExceptionLevel,
	type TracingHeaders,
	type TracingSpan,
} from "@orpc/shared";
import { isClientErrorCode } from "@/lib/orpc/implementation/error-mapping";
import packageJson from "../../../../package.json" with { type: "json" };

const isClientORPCError = (exception: TracingException) =>
	exception.name === "ORPCError" &&
	typeof exception.code === "string" &&
	isClientErrorCode(exception.code);

class ClientErrorAwareSpan implements TracingSpan {
	constructor(readonly inner: TracingSpan) {}

	setAttribute(key: string, value: TracingAttributeValue) {
		this.inner.setAttribute(key, value);
	}

	updateName(name: string) {
		this.inner.updateName(name);
	}

	addEvent(name: string) {
		this.inner.addEvent(name);
	}

	recordException(level: TracingExceptionLevel, exception: TracingException) {
		this.inner.recordException(
			isClientORPCError(exception) ? "info" : level,
			exception,
		);
	}

	end() {
		this.inner.end();
	}
}

const wrap = (span: TracingSpan) => new ClientErrorAwareSpan(span);
// The inner tracer reads its own span type back from parents.
const unwrap = (span: TracingSpan) =>
	span instanceof ClientErrorAwareSpan ? span.inner : span;

export class ClientErrorAwareTracer implements Tracer {
	constructor(private readonly inner: Tracer) {}

	startSpan(name: string, parent?: TracingSpan) {
		return wrap(this.inner.startSpan(name, parent && unwrap(parent)));
	}

	startActiveSpan<T>(
		name: string,
		parent: TracingSpan | undefined,
		fn: (span: TracingSpan) => Promise<T>,
	) {
		return this.inner.startActiveSpan(name, parent && unwrap(parent), (span) =>
			fn(wrap(span)),
		);
	}

	getActiveSpan() {
		const span = this.inner.getActiveSpan();
		return span && wrap(span);
	}

	withActiveSpan<T>(span: TracingSpan, fn: () => T | Promise<T>) {
		return this.inner.withActiveSpan(unwrap(span), fn);
	}

	inject(span: TracingSpan, headers: TracingHeaders) {
		this.inner.inject?.(unwrap(span), headers);
	}

	extract(headers: TracingHeaders) {
		const span = this.inner.extract?.(headers);
		return span && wrap(span);
	}
}

/**
 * oRPC records every thrown error at "error", failing its spans, before any
 * interceptor runs, and has no option per error. Its tracer is replaced
 * through `setTracer` so a client error such as FORBIDDEN is recorded at "info".
 */
class AppORPCInstrumentation extends ORPCInstrumentation {
	override enable() {
		super.enable();
		const tracer = getTracer();
		if (tracer) setTracer(new ClientErrorAwareTracer(tracer));
	}
}

export const ObservabilityLive = makeObservabilityLayer({
	serviceName: "orcai-app",
	serviceVersion: packageJson.version,
	additionalInstrumentations: [
		new AppORPCInstrumentation(),
	],
});
