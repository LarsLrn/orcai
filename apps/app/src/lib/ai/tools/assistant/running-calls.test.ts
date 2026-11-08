import { describe, expect, test } from "bun:test";
import type { Tool, ToolExecutionOptions, UIMessage } from "ai";
import { createRunningCalls } from "./running-calls";

/** A tool whose call ends when the test resolves or rejects it, and which notes the signal it got. */
const heldTool = () => {
	const call = Promise.withResolvers<unknown>();
	const signals: (AbortSignal | undefined)[] = [];
	const tool = {
		inputSchema: {},
		execute: (_input: unknown, options: ToolExecutionOptions<never>) => {
			signals.push(options.abortSignal);
			return call.promise;
		},
	} as unknown as Tool;

	return {
		tool,
		call,
		signals,
	};
};

const run = (tool: Tool, toolCallId: string, abortSignal?: AbortSignal) =>
	Promise.resolve(
		tool.execute?.(
			{},
			{
				toolCallId,
				messages: [],
				abortSignal,
				context: {} as never,
			},
		),
	).catch(() => undefined);

const runningPart = (type: string, toolCallId: string) =>
	({
		type,
		toolCallId,
		state: "input-available",
		input: {},
	}) as UIMessage["parts"][number];

describe("createRunningCalls", () => {
	test("runs a change without the call's abort signal, and a read with it", () => {
		const calls = createRunningCalls();
		const change = heldTool();
		const read = heldTool();
		const tools = calls.wrap({
			publishBot: change.tool,
			getBot: read.tool,
		});
		const stop = new AbortController();

		void run(tools.publishBot, "call-1", stop.signal);
		void run(tools.getBot, "call-2", stop.signal);

		expect(change.signals).toEqual([
			undefined,
		]);
		expect(read.signals).toEqual([
			stop.signal,
		]);
	});

	test("waits for a running call and gives its part the output it returned", async () => {
		const calls = createRunningCalls();
		const { tool, call } = heldTool();
		const tools = calls.wrap({
			publishBot: tool,
		});
		void run(tools.publishBot, "call-1");

		const settled = calls.settled();
		call.resolve({
			published: true,
		});
		await settled;

		expect(
			calls.finish([
				runningPart("tool-publishBot", "call-1"),
			]),
		).toEqual([
			{
				type: "tool-publishBot",
				toolCallId: "call-1",
				state: "output-available",
				input: {},
				output: {
					published: true,
				},
			},
		]);
	});

	test("a failed call ends the wait and stays running for the close", async () => {
		const calls = createRunningCalls();
		const { tool, call } = heldTool();
		const tools = calls.wrap({
			publishBot: tool,
		});
		void run(tools.publishBot, "call-1");
		call.reject(new Error("connection reset"));

		await calls.settled();

		expect(
			calls.finish([
				runningPart("tool-publishBot", "call-1"),
			]),
		).toEqual([
			runningPart("tool-publishBot", "call-1"),
		]);
	});

	test("stops waiting at the bound, and a call that ends later changes nothing", async () => {
		const bound = new AbortController();
		const calls = createRunningCalls(() => bound.signal);
		const late = heldTool();
		const failing = heldTool();
		const tools = calls.wrap({
			publishBot: late.tool,
			deleteBot: failing.tool,
		});
		void run(tools.publishBot, "call-1");
		void run(tools.deleteBot, "call-2");
		const unhandled: unknown[] = [];
		const onUnhandled = (reason: unknown) => unhandled.push(reason);
		process.on("unhandledRejection", onUnhandled);

		const settled = calls.settled();
		bound.abort();
		await settled;
		const atBound = calls.finish([
			runningPart("tool-publishBot", "call-1"),
		]);
		late.call.resolve({});
		failing.call.reject(new Error("connection reset"));
		await new Promise((resolve) => setTimeout(resolve, 10));
		process.off("unhandledRejection", onUnhandled);

		expect(atBound).toEqual([
			runningPart("tool-publishBot", "call-1"),
		]);
		expect(unhandled).toEqual([]);
	});
});
