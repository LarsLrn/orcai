import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { metrics, trace } from "@opentelemetry/api";
import {
	InMemoryLogRecordExporter,
	SimpleLogRecordProcessor,
} from "@opentelemetry/sdk-logs";
import {
	AggregationTemporality,
	InMemoryMetricExporter,
	PeriodicExportingMetricReader,
} from "@opentelemetry/sdk-metrics";
import {
	InMemorySpanExporter,
	SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import * as Effect from "effect/Effect";
import * as ManagedRuntime from "effect/ManagedRuntime";
import { makeLayer } from "../src/service";
import { withActiveSpan } from "../src/tracing";

const makeHarness = () => {
	const spanExporter = new InMemorySpanExporter();
	const logExporter = new InMemoryLogRecordExporter();
	const metricExporter = new InMemoryMetricExporter(
		AggregationTemporality.CUMULATIVE,
	);
	const spanProcessor = new SimpleSpanProcessor(spanExporter);
	const logRecordProcessor = new SimpleLogRecordProcessor({
		exporter: logExporter,
	});
	const metricReader = new PeriodicExportingMetricReader({
		exporter: metricExporter,
		exportIntervalMillis: 3_600_000,
	});

	const runtime = ManagedRuntime.make(
		makeLayer({
			serviceName: "orcai-test",
			serviceVersion: "1.2.3",
			spanProcessor,
			logRecordProcessor,
			metricReader,
		}),
	);

	const flush = async () => {
		await spanProcessor.forceFlush();
		await logRecordProcessor.forceFlush();
		await metricReader.forceFlush();
	};

	return {
		runtime,
		flush,
		spans: () => spanExporter.getFinishedSpans(),
		logs: () => logExporter.getFinishedLogRecords(),
		metrics: () => metricExporter.getMetrics(),
	};
};

const expectedResource = {
	"deployment.environment": "test",
	"service.name": "orcai-test",
	"service.version": "1.2.3",
};

describe("makeLayer", () => {
	const env = {
		OTEL_RESOURCE_ATTRIBUTES: process.env.OTEL_RESOURCE_ATTRIBUTES,
		OTEL_SERVICE_NAME: process.env.OTEL_SERVICE_NAME,
	};
	let harness: ReturnType<typeof makeHarness>;

	beforeEach(() => {
		process.env.OTEL_RESOURCE_ATTRIBUTES =
			"deployment.environment=test,service.name=from-env";
		delete process.env.OTEL_SERVICE_NAME;
		harness = makeHarness();
	});

	afterEach(async () => {
		await harness.runtime.dispose();
		for (const [key, value] of Object.entries(env)) {
			if (value === undefined) delete process.env[key];
			else process.env[key] = value;
		}
	});

	test("spans, log records and metrics share the resource from the environment", async () => {
		await harness.runtime.runPromise(
			Effect.logInfo("hello").pipe(Effect.withSpan("work")),
		);
		metrics.getMeter("test").createCounter("test.counter").add(1);
		await harness.flush();

		const [span] = harness.spans();
		const [log] = harness.logs();
		const [metric] = harness.metrics();

		expect(span?.resource.attributes).toMatchObject(expectedResource);
		expect(log?.resource.attributes).toMatchObject(expectedResource);
		expect(metric?.resource.attributes).toMatchObject(expectedResource);
	});

	test("a log emitted inside a span carries its trace context on the record", async () => {
		await harness.runtime.runPromise(
			Effect.logInfo("inside").pipe(Effect.withSpan("work")),
		);
		await harness.flush();

		const [span] = harness.spans();
		const [log] = harness.logs();

		expect(span).toBeDefined();
		expect(log?.spanContext?.traceId).toBe(span?.spanContext().traceId);
		expect(log?.spanContext?.spanId).toBe(span?.spanContext().spanId);
	});

	test("withActiveSpan parents Effect spans and logs under the active OpenTelemetry span", async () => {
		await harness.runtime.runPromise(Effect.void);

		const outer = await trace
			.getTracer("test")
			.startActiveSpan("outer", async (span) => {
				await harness.runtime.runPromise(
					withActiveSpan(
						Effect.logInfo("unscoped").pipe(
							Effect.andThen(Effect.void.pipe(Effect.withSpan("inner"))),
						),
					),
				);
				span.end();
				return span.spanContext();
			});
		await harness.flush();

		const inner = harness.spans().find((span) => span.name === "inner");
		const [log] = harness.logs();

		expect(inner?.spanContext().traceId).toBe(outer.traceId);
		expect(inner?.parentSpanContext?.spanId).toBe(outer.spanId);
		expect(log?.spanContext?.traceId).toBe(outer.traceId);
		expect(log?.spanContext?.spanId).toBe(outer.spanId);
	});
});
