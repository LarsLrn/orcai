import { describe, expect, test } from "bun:test";
import type { ModelMessage } from "ai";
import { pruneAssistantHistory } from "./assistant-history-pruning";

const user = (text: string): ModelMessage => ({
	role: "user",
	content: text,
});

const call = (
	toolName: string,
	id: string,
	output: Extract<
		ModelMessage,
		{
			role: "tool";
		}
	>["content"][number] = {
		type: "tool-result",
		toolCallId: id,
		toolName,
		output: {
			type: "json",
			value: {
				full: true,
			},
		},
	},
): ModelMessage[] => [
	{
		role: "assistant",
		content: [
			{
				type: "tool-call",
				toolCallId: id,
				toolName,
				input: {
					query: id,
				},
			},
		],
	},
	{
		role: "tool",
		content: [
			output,
		],
	},
];

const outputsOf = (messages: ModelMessage[]) =>
	Object.fromEntries(
		messages.flatMap((message) =>
			message.role === "tool"
				? message.content.map((part) =>
						part.type === "tool-result"
							? [
									part.toolCallId,
									part.output,
								]
							: [
									part.approvalId,
									part.type,
								],
					)
				: [],
		),
	);

const prune = (messages: ModelMessage[], enabledDisplayToolNames = []) =>
	pruneAssistantHistory(messages, {
		lines: new Map([
			[
				"a",
				"Found 3 bots",
			],
			[
				"b",
				"Read the docs page “Bots” (/docs/using-orcai/bots)",
			],
		]),
		displayToolNames: [
			"showChecklist",
		],
		enabledDisplayToolNames,
	});

describe("pruneAssistantHistory", () => {
	test("replaces outputs before the latest step with their summary line", () => {
		const outputs = outputsOf(
			prune([
				user("hi"),
				...call("findBots", "a"),
				...call("readDocs", "b"),
				...call("getBot", "c"),
			]),
		);

		expect(outputs.a).toEqual({
			type: "text",
			value: "Found 3 bots",
		});
		expect(outputs.b).toEqual({
			type: "text",
			value: "Read the docs page “Bots” (/docs/using-orcai/bots)",
		});
		expect(outputs.c).toEqual({
			type: "json",
			value: {
				full: true,
			},
		});
	});

	test("keeps every tool call and its input", () => {
		const pruned = prune([
			...call("findBots", "a"),
			...call("getBot", "c"),
		]);

		expect(
			pruned.flatMap((message) =>
				message.role === "assistant" && Array.isArray(message.content)
					? message.content
					: [],
			),
		).toEqual([
			{
				type: "tool-call",
				toolCallId: "a",
				toolName: "findBots",
				input: {
					query: "a",
				},
			},
			{
				type: "tool-call",
				toolCallId: "c",
				toolName: "getBot",
				input: {
					query: "c",
				},
			},
		]);
	});

	test("summarises every output once the latest assistant message is text", () => {
		const outputs = outputsOf(
			prune([
				...call("findBots", "a"),
				{
					role: "assistant",
					content: "You have three bots.",
				},
				user("Thanks"),
			]),
		);

		expect(outputs.a).toEqual({
			type: "text",
			value: "Found 3 bots",
		});
	});

	test("leaves errors, denials and approval responses untouched", () => {
		const error = {
			type: "tool-result",
			toolCallId: "e",
			toolName: "deleteBot",
			output: {
				type: "error-text",
				value: "FORBIDDEN: no",
			},
		} as const;
		const denied = {
			type: "tool-result",
			toolCallId: "d",
			toolName: "deleteBot",
			output: {
				type: "execution-denied",
			},
		} as const;
		const approved: ModelMessage[] = [
			{
				role: "assistant",
				content: [
					{
						type: "tool-call",
						toolCallId: "a",
						toolName: "deleteBot",
						input: {},
					},
					{
						type: "tool-approval-request",
						approvalId: "approval",
						toolCallId: "a",
					},
				],
			},
			{
				role: "tool",
				content: [
					{
						type: "tool-approval-response",
						approvalId: "approval",
						approved: true,
					},
					{
						type: "tool-result",
						toolCallId: "a",
						toolName: "deleteBot",
						output: {
							type: "json",
							value: {
								full: true,
							},
						},
					},
				],
			},
		];
		const outputs = outputsOf(
			prune([
				...call("deleteBot", "e", error),
				...call("deleteBot", "d", denied),
				...approved,
				...call("getBot", "c"),
			]),
		);

		expect(outputs.e).toEqual(error.output);
		expect(outputs.d).toEqual(denied.output);
		expect(outputs.approval).toBe("tool-approval-response");
		expect(outputs.a).toEqual({
			type: "text",
			value: "Found 3 bots",
		});
	});

	test("falls back to a generic line for tools without one", () => {
		const outputs = outputsOf(
			prune([
				...call("mysteryTool", "x"),
				...call("getBot", "c"),
			]),
		);

		expect(outputs.x).toEqual({
			type: "text",
			value: "Called mysteryTool; its output is no longer available",
		});
	});

	test("keeps enabled display calls and drops disabled ones", () => {
		const messages = [
			...call("showChecklist", "s"),
			...call("getBot", "c"),
		];

		expect(outputsOf(prune(messages)).s).toBeUndefined();
		expect(
			outputsOf(
				pruneAssistantHistory(messages, {
					lines: new Map(),
					displayToolNames: [
						"showChecklist",
					],
					enabledDisplayToolNames: [
						"showChecklist",
					],
				}),
			).s,
		).toEqual({
			type: "json",
			value: {
				full: true,
			},
		});
	});
});
