import { describe, expect, test } from "bun:test";
import { type ToolSet, tool, type UIMessage } from "ai";
import { z } from "zod/v4";
import {
	closePendingToolParts,
	TOOL_CLOSE_SENTENCES,
	toolCloseCode,
} from "./close-pending-tool-parts";

type Part = UIMessage["parts"][number];

const tools: ToolSet = {
	search: tool({
		inputSchema: z.object({
			query: z.string(),
		}),
		execute: async () => "found",
	}),
	pick: tool({
		inputSchema: z.object({
			options: z.array(z.string()),
		}),
	}),
};

const close = (part: Part) =>
	closePendingToolParts(
		[
			part,
		],
		tools,
	);

describe("closePendingToolParts", () => {
	test("denies a requested approval as superseded", () => {
		const result = close({
			type: "tool-search",
			toolCallId: "call-1",
			state: "approval-requested",
			input: {
				query: "q",
			},
			approval: {
				id: "approval-1",
			},
		});

		expect(result).toEqual({
			changed: true,
			parts: [
				{
					type: "tool-search",
					toolCallId: "call-1",
					state: "output-denied",
					input: {
						query: "q",
					},
					approval: {
						id: "approval-1",
						approved: false,
						reason: TOOL_CLOSE_SENTENCES.superseded,
					},
				},
			],
		});
	});

	test("fails a client tool call without output as superseded", () => {
		const result = close({
			type: "tool-pick",
			toolCallId: "call-1",
			state: "input-available",
			input: {
				options: [
					"a",
				],
			},
		});

		expect(result.parts).toEqual([
			{
				type: "tool-pick",
				toolCallId: "call-1",
				state: "output-error",
				input: {
					options: [
						"a",
					],
				},
				errorText: TOOL_CLOSE_SENTENCES.superseded,
			},
		]);
	});

	test("fails a server tool call without result as interrupted", () => {
		const result = close({
			type: "tool-search",
			toolCallId: "call-1",
			state: "input-available",
			input: {
				query: "q",
			},
		});

		expect(result.parts).toEqual([
			{
				type: "tool-search",
				toolCallId: "call-1",
				state: "output-error",
				input: {
					query: "q",
				},
				errorText: TOOL_CLOSE_SENTENCES.interrupted,
			},
		]);
	});

	test("fails a call to a tool the agent no longer has as interrupted", () => {
		const result = close({
			type: "dynamic-tool",
			toolName: "removed",
			toolCallId: "call-1",
			state: "input-available",
			input: {},
		});

		expect(result.parts[0]).toMatchObject({
			state: "output-error",
			errorText: TOOL_CLOSE_SENTENCES.interrupted,
		});
	});

	test("fails a streaming call as interrupted with its partial input", () => {
		const partial = close({
			type: "tool-search",
			toolCallId: "call-1",
			state: "input-streaming",
			input: {
				query: "pa",
			},
		});
		const empty = close({
			type: "tool-pick",
			toolCallId: "call-2",
			state: "input-streaming",
			input: undefined,
		});

		expect(partial.parts[0]).toEqual({
			type: "tool-search",
			toolCallId: "call-1",
			state: "output-error",
			input: {
				query: "pa",
			},
			errorText: TOOL_CLOSE_SENTENCES.interrupted,
		});
		expect(empty.parts[0]).toMatchObject({
			state: "output-error",
			input: {},
			errorText: TOOL_CLOSE_SENTENCES.interrupted,
		});
	});

	test("leaves finished and answered parts alone", () => {
		const parts: Part[] = [
			{
				type: "step-start",
			},
			{
				type: "text",
				text: "Answer",
			},
			{
				type: "tool-search",
				toolCallId: "call-1",
				state: "output-available",
				input: {
					query: "q",
				},
				output: "found",
			},
			{
				type: "tool-search",
				toolCallId: "call-2",
				state: "output-error",
				input: {
					query: "q",
				},
				errorText: "Boom",
			},
			{
				type: "tool-search",
				toolCallId: "call-3",
				state: "output-denied",
				input: {
					query: "q",
				},
				approval: {
					id: "approval-3",
					approved: false,
				},
			},
			{
				type: "tool-search",
				toolCallId: "call-4",
				state: "approval-responded",
				input: {
					query: "q",
				},
				approval: {
					id: "approval-4",
					approved: true,
				},
			},
		];

		const result = closePendingToolParts(parts, tools);

		expect(result.changed).toBe(false);
		expect(result.parts).toEqual(parts);
	});

	test("closes every pending part across steps", () => {
		const result = closePendingToolParts(
			[
				{
					type: "step-start",
				},
				{
					type: "tool-search",
					toolCallId: "call-1",
					state: "input-available",
					input: {
						query: "q",
					},
				},
				{
					type: "step-start",
				},
				{
					type: "tool-search",
					toolCallId: "call-2",
					state: "output-available",
					input: {
						query: "q",
					},
					output: "found",
				},
				{
					type: "tool-pick",
					toolCallId: "call-3",
					state: "input-streaming",
					input: undefined,
				},
			],
			tools,
		);

		expect(result.changed).toBe(true);
		expect(
			result.parts.map((part) => ("state" in part ? part.state : part.type)),
		).toEqual([
			"step-start",
			"output-error",
			"step-start",
			"output-available",
			"output-error",
		]);
	});
});

describe("toolCloseCode", () => {
	test("reads a code back from its sentence", () => {
		expect(toolCloseCode(TOOL_CLOSE_SENTENCES.superseded)).toBe("superseded");
		expect(toolCloseCode(TOOL_CLOSE_SENTENCES.interrupted)).toBe("interrupted");
		expect(toolCloseCode("Boom")).toBeUndefined();
		expect(toolCloseCode(undefined)).toBeUndefined();
	});
});
