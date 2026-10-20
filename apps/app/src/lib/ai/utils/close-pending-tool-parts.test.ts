import { describe, expect, test } from "bun:test";
import { type ToolSet, tool, type UIMessage } from "ai";
import { z } from "zod/v4";
import {
	closeCopiedToolParts,
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

	test("denies an approved call that never ran as superseded", () => {
		const result = close({
			type: "tool-search",
			toolCallId: "call-1",
			state: "approval-responded",
			input: {
				query: "q",
			},
			approval: {
				id: "approval-1",
				approved: true,
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

	test("closes a denied call that never ran with the user's denial", () => {
		const result = close({
			type: "tool-search",
			toolCallId: "call-1",
			state: "approval-responded",
			input: {
				query: "q",
			},
			approval: {
				id: "approval-1",
				approved: false,
				reason: "Not now",
			},
		});

		expect(result.parts).toEqual([
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
					reason: "Not now",
				},
			},
		]);
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

	test("leaves finished parts alone", () => {
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

describe("closeCopiedToolParts", () => {
	test("closes pending calls in copied replies only", () => {
		const question = {
			id: "m1",
			role: "user",
			parts: [
				{
					type: "text",
					text: "Delete it",
				},
			],
		};
		const finished = {
			id: "m2",
			role: "assistant",
			parts: [
				{
					type: "step-start",
				},
				{
					type: "text",
					text: "Done",
				},
			],
		};
		const paused = {
			id: "m3",
			role: "assistant",
			parts: [
				{
					type: "step-start",
				},
				{
					type: "tool-search",
					toolCallId: "call-1",
					state: "approval-requested",
					input: {
						query: "q",
					},
					approval: {
						id: "approval-1",
					},
				},
				{
					type: "tool-search",
					toolCallId: "call-2",
					state: "approval-responded",
					input: {
						query: "q",
					},
					approval: {
						id: "approval-2",
						approved: true,
					},
				},
			],
		};

		const [copiedQuestion, copiedFinished, copiedPaused] = closeCopiedToolParts(
			[
				question,
				finished,
				paused,
			],
		);

		expect(copiedQuestion).toBe(question);
		expect(copiedFinished).toBe(finished);
		expect(copiedPaused).toEqual({
			id: "m3",
			role: "assistant",
			parts: [
				{
					type: "step-start",
				},
				...[
					"1",
					"2",
				].map((n) => ({
					type: "tool-search",
					toolCallId: `call-${n}`,
					state: "output-denied",
					input: {
						query: "q",
					},
					approval: {
						id: `approval-${n}`,
						approved: false,
						reason: TOOL_CLOSE_SENTENCES.superseded,
					},
				})),
			],
		});
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
