import { describe, expect, test } from "bun:test";
import {
	chatMessagePartSchema,
	chatMessageSchema,
	mergeReadableParts,
	readableChatMessageParts,
} from "../src";

const knownParts = [
	{
		type: "step-start",
	},
	{
		type: "reasoning",
		text: "Looking it up.",
		state: "done",
	},
	{
		type: "text",
		text: "Earlier turns, summarized.",
		state: "done",
		providerMetadata: {
			anthropic: {
				type: "compaction",
			},
		},
	},
	{
		type: "custom",
		kind: "openai.compaction",
		providerMetadata: {
			openai: {
				itemId: "cmp_1",
			},
		},
	},
	{
		type: "tool-searchAssets",
		toolCallId: "call-1",
		state: "output-available",
		input: {
			query: "refunds",
		},
		output: {
			results: [],
		},
	},
	{
		type: "tool-deleteBot",
		toolCallId: "call-2",
		state: "approval-requested",
		input: {
			botId: "bot-1",
		},
		approval: {
			id: "approval-1",
		},
	},
	{
		type: "tool-requestUpload",
		toolCallId: "call-3",
		state: "output-error",
		input: undefined,
		errorText: "The upload was cancelled.",
	},
	{
		type: "dynamic-tool",
		toolName: "retiredTool",
		toolCallId: "call-4",
		state: "output-available",
		input: {},
		output: "done",
	},
	{
		type: "source-url",
		sourceId: "source-1",
		url: "https://example.org",
	},
] as const;

/** An AI SDK 4 tool call, stored before the parts format changed. */
const oldToolInvocation = {
	type: "tool-invocation",
	toolInvocation: {
		state: "result",
		toolCallId: "call-0",
		toolName: "searchAssets",
		args: {},
		result: {},
	},
};

const brokenText = {
	type: "text",
	content: "A text part without its text.",
};

const futurePart = {
	type: "future-part",
	payload: {
		kept: true,
	},
};

describe("chat message parts", () => {
	test("every known variant validates as written", () => {
		for (const part of knownParts) {
			expect(chatMessagePartSchema.parse(part)).toEqual(part);
		}
	});

	test("a part keeps fields its schema does not name", () => {
		const part = {
			type: "text",
			text: "Hello",
			citations: [],
		} as const;

		expect(chatMessagePartSchema.parse(part)).toEqual(part);
	});

	test("a write rejects a known variant without what its state carries", () => {
		for (const part of [
			brokenText,
			oldToolInvocation,
			futurePart,
			{
				type: "tool-searchAssets",
				toolCallId: "call-1",
				state: "output-error",
				input: {},
			},
			{
				type: "tool-deleteBot",
				toolCallId: "call-2",
				state: "approval-requested",
				input: {},
			},
		]) {
			expect(chatMessagePartSchema.safeParse(part).success).toBe(false);
		}
	});

	test("reading leaves out what this version cannot read and keeps the rest in order", () => {
		expect(
			readableChatMessageParts([
				knownParts[0],
				oldToolInvocation,
				knownParts[2],
				brokenText,
				futurePart,
				null,
				knownParts[4],
			]),
		).toEqual([
			knownParts[0],
			knownParts[2],
			knownParts[4],
		]);
	});

	test("a stored message reads with its readable parts", () => {
		const message = chatMessageSchema.parse({
			id: "6f1d2c3b-4a5e-4f60-8a7b-9c0d1e2f3a4b",
			chatId: "0a1b2c3d-4e5f-4061-8728-394a5b6c7d8e",
			role: "assistant",
			parts: [
				oldToolInvocation,
				...knownParts,
				futurePart,
			],
			attachments: [],
			metadata: {},
			position: 1,
			createdAt: "2026-11-08T10:00:00.000Z",
		});

		expect(message.parts).toEqual([
			...knownParts,
		]);
	});

	test("a write puts readable parts in their places and keeps the rest", () => {
		const stored = [
			oldToolInvocation,
			knownParts[1],
			futurePart,
			knownParts[2],
		];
		const replaced = {
			type: "text",
			text: "Rewritten",
		} as const;

		expect(
			mergeReadableParts(stored, [
				knownParts[1],
				replaced,
				knownParts[0],
			]),
		).toEqual([
			oldToolInvocation,
			knownParts[1],
			futurePart,
			replaced,
			knownParts[0],
		]);
		expect(
			mergeReadableParts(stored, [
				replaced,
			]),
		).toEqual([
			oldToolInvocation,
			replaced,
			futurePart,
		]);
		expect(mergeReadableParts([], [])).toEqual([]);
	});
});
