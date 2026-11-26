import { describe, expect, test } from "bun:test";
import { ORPCError } from "@orpc/server";
import type { Tracer, TracingExceptionLevel, TracingSpan } from "@orpc/shared";
import { ClientErrorAwareTracer } from "./observability";

const recorded: [
	TracingExceptionLevel,
	unknown,
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
		const errors = [
			new ORPCError("FORBIDDEN"),
			new ORPCError("INTERNAL_SERVER_ERROR"),
			new ORPCError("UNKNOWN_CODE"),
			Object.assign(new Error("not an oRPC error"), {
				code: "NOT_FOUND",
			}),
		];
		for (const error of errors) span.recordException("error", error);

		expect(recorded.map(([level]) => level)).toEqual([
			"info",
			"error",
			"error",
			"error",
		]);
		recorded.forEach(([, error], index) => {
			expect(error).toBe(errors[index]);
		});
	});

	test("the inner tracer gets its own span back as a parent", () => {
		parents.length = 0;
		tracer.startSpan("child", tracer.startSpan("parent"));

		expect(parents.at(-1)).toBe(innerSpan);
	});
});
