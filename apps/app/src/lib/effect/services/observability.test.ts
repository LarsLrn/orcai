import { describe, expect, test } from "bun:test";
import type {
	Tracer,
	TracingException,
	TracingExceptionLevel,
	TracingSpan,
} from "@orpc/shared";
import { ClientErrorAwareTracer } from "./observability";

const recorded: [
	TracingExceptionLevel,
	TracingException,
][] = [];
const innerSpan: TracingSpan = {
	setAttribute: () => undefined,
	updateName: () => undefined,
	addEvent: () => undefined,
	recordException: (level, exception) => {
		recorded.push([
			level,
			exception,
		]);
	},
	end: () => undefined,
};
const parents: (TracingSpan | undefined)[] = [];
const inner: Tracer = {
	startSpan: (_name, parent) => {
		parents.push(parent);
		return innerSpan;
	},
	startActiveSpan: (_name, _parent, fn) => fn(innerSpan),
	getActiveSpan: () => innerSpan,
	withActiveSpan: (_span, fn) => fn(),
};

describe("ClientErrorAwareTracer", () => {
	const tracer = new ClientErrorAwareTracer(inner);

	test("a client ORPCError is recorded at info and anything else keeps its level", () => {
		recorded.length = 0;
		const span = tracer.startSpan("call_procedure");
		span.recordException("error", {
			name: "ORPCError",
			code: "FORBIDDEN",
			message: "Forbidden",
		});
		span.recordException("error", {
			name: "ORPCError",
			code: "INTERNAL_SERVER_ERROR",
			message: "Internal Server Error",
		});
		span.recordException("error", {
			name: "Error",
			code: "NOT_FOUND",
			message: "not an oRPC error",
		});

		expect(recorded.map(([level]) => level)).toEqual([
			"info",
			"error",
			"error",
		]);
	});

	test("the inner tracer gets its own span back as a parent", () => {
		parents.length = 0;
		tracer.startSpan("child", tracer.startSpan("parent"));

		expect(parents.at(-1)).toBe(innerSpan);
	});
});
